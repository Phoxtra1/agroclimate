import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WEEKLY_QUOTA = 5;
const MODEL = "openai/gpt-6-astra";

const PROFILE = `AgroClimate is a Ghana-based agriculture & climate intelligence platform for African smallholder farmers:
live weather and climate-risk alerts, flood/drought early warning, crop and livestock advisory, aquaculture monitoring,
drone/aerial field intelligence, a farmer–buyer market link, agri-logistics (transport matching) and SMS alerts for low-connectivity users.
It is a registered early-stage agri-tech/climate-tech startup led by an African (Ghanaian) founder.`;

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normLink = (u: string) => (u || "").trim().toLowerCase().replace(/\/+$/, "");
const fingerprintOf = (org: string, title: string) => `${clean(org).slice(0, 40)}-${clean(title).slice(0, 80)}`;

const candidateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "organisation_name", "title", "category", "funding_amount", "currency", "eligible_countries",
          "eligibility_requirements", "required_documents", "deadline", "application_portal_url", "source_url",
          "why_agroclimate_fits", "eligibility_assessment", "relevance_score",
        ],
        properties: {
          organisation_name: { type: "string" },
          title: { type: "string" },
          category: { type: "string", enum: ["agri-tech", "agriculture", "climate_resilience", "sustainable_food_systems", "climate_tech", "innovation"] },
          funding_amount: { type: ["number", "null"] },
          currency: { type: "string" },
          eligible_countries: { type: "array", items: { type: "string" } },
          eligibility_requirements: { type: "string" },
          required_documents: { type: "array", items: { type: "string" } },
          deadline: { type: ["string", "null"], description: "ISO date YYYY-MM-DD, or null if rolling" },
          application_portal_url: { type: "string", description: "Direct URL of the page/portal where applications are submitted" },
          source_url: { type: "string" },
          why_agroclimate_fits: { type: "string" },
          eligibility_assessment: { type: "string", enum: ["Fully Eligible", "High Eligibility", "Conditional Eligibility"] },
          relevance_score: { type: "number" },
        },
      },
    },
  },
};

class GatewayError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function askDipa(apiKey: string, exclude: string[], today: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "funding_candidates", strict: true, schema: candidateSchema } },
      input: [
        {
          role: "system",
          content: `You are Dipa, AgroClimate's funding scout. Today is ${today}.
Return up to 15 funding opportunities (grants, accelerators with funding, challenge prizes, climate/agri innovation funds)
whose application portal is OPEN and accepting applications now or recurs on a known annual cycle that is currently open,
and that AgroClimate is genuinely eligible for. Applicant profile:\n${PROFILE}
Rules: give the direct application portal URL (not a news article or a generic homepage). Only use organisations and URLs you are confident exist.
Never include closed calls, loans-only products, or anything listed in the exclusion list. Prefer Ghana / West Africa / pan-African eligibility.`,
        },
        { role: "user", content: `Exclusion list (already known, do not repeat):\n${exclude.slice(0, 300).join("\n") || "(none)"}` },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let msg = t;
    try { msg = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || t; } catch { /* raw */ }
    throw new GatewayError(res.status, msg || `AI request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let ev: any;
      try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === "response.output_text.delta") text += ev.delta || "";
      else if (ev.type === "response.refusal.delta") throw new GatewayError(422, "The discovery request was declined.");
      else if (ev.type === "error" || ev.type === "response.failed")
        throw new GatewayError(502, ev.error?.message || ev.response?.error?.message || "Discovery failed");
    }
  }
  if (!text.trim()) throw new GatewayError(422, "Discovery returned no results.");
  return (JSON.parse(text).candidates || []) as any[];
}

const OPEN_WORDS = /(apply now|apply here|submit (your )?application|application form|applications? (are )?(now )?open|call for (applications|proposals)|register to apply|start (your )?application|deadline)/i;
const CLOSED_WORDS = /(applications? (are |is )?(now )?closed|call (is )?closed|no longer accepting|submission period has ended|this call has closed)/i;

async function verifyPortal(url: string) {
  try {
    if (!/^https:\/\//i.test(url)) return { ok: false, reason: "not https" };
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (AgroClimate Dipa funding verifier)", Accept: "text/html" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const html = (await r.text()).slice(0, 400000);
    const textOnly = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (CLOSED_WORDS.test(textOnly)) return { ok: false, reason: "portal says closed" };
    if (!OPEN_WORDS.test(textOnly) && !/<form/i.test(html)) return { ok: false, reason: "no application entry point" };
    const m = textOnly.match(new RegExp(`.{0,160}${OPEN_WORDS.source}.{0,160}`, "i"));
    return { ok: true, finalUrl: r.url, snippet: (m?.[0] || textOnly.slice(0, 300)).trim() };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const refreshType = body?.action === "scheduled_refresh" ? "scheduled" : "manual";
  const week = isoWeek();
  const now = new Date();

  // Mark expired items based on their stored deadline (no fabricated dates).
  await supabase.from("agrofund_opportunities").update({ is_expired: true })
    .lt("deadline", now.toISOString()).eq("is_expired", false);

  // Single-flight lock: skip if another run started in the last 10 minutes.
  const { data: running } = await supabase.from("agrofund_refresh_logs").select("id")
    .eq("status", "in_progress").gte("created_at", new Date(Date.now() - 10 * 60000).toISOString()).limit(1);
  if (running?.length) return json({ success: true, summary: { skipped: true, reason: "A discovery run is already in progress." } });

  const { count: weekCount } = await supabase.from("agrofund_opportunities")
    .select("id", { count: "exact", head: true }).eq("discovery_week", week);
  const remaining = Math.max(0, WEEKLY_QUOTA - (weekCount || 0));

  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7 || 7));
  nextMonday.setUTCHours(6, 0, 0, 0);

  if (remaining === 0) {
    const { data: log } = await supabase.from("agrofund_refresh_logs").insert({
      refresh_type: refreshType, status: "success", opportunities_found: 0, new_inserted: 0, records_updated: 0,
      error_message: `Weekly quota of ${WEEKLY_QUOTA} new opportunities already reached for ${week}.`,
    }).select().single();
    return json({ success: true, summary: { week, quotaReached: true, newInserted: 0, nextScheduledRefresh: nextMonday.toISOString() }, refreshLog: log });
  }

  const { data: lock } = await supabase.from("agrofund_refresh_logs")
    .insert({ refresh_type: refreshType, status: "in_progress" }).select("id").single();

  const finish = async (patch: Record<string, unknown>) => {
    const { data } = await supabase.from("agrofund_refresh_logs")
      .update({ ...patch, completed_at: new Date().toISOString() }).eq("id", lock!.id).select().single();
    return data;
  };

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new GatewayError(401, "AI discovery is not configured.");

    const { data: existing } = await supabase.from("agrofund_opportunities")
      .select("fingerprint, official_application_link, organisation_name, title");
    const fps = new Set((existing || []).map((e: any) => e.fingerprint));
    const links = new Set((existing || []).map((e: any) => normLink(e.official_application_link)));
    const exclude = (existing || []).map((e: any) => `${e.organisation_name} — ${e.title} (${e.official_application_link})`);

    const candidates = await askDipa(apiKey, exclude, now.toISOString().slice(0, 10));
    const rejected: string[] = [];
    let inserted = 0;

    for (const c of candidates) {
      if (inserted >= remaining) break;
      const fp = fingerprintOf(c.organisation_name, c.title);
      const link = normLink(c.application_portal_url);
      if (fps.has(fp) || links.has(link)) { rejected.push(`${c.title}: duplicate`); continue; }
      if (c.deadline && new Date(c.deadline) < now) { rejected.push(`${c.title}: deadline passed`); continue; }

      const v = await verifyPortal(c.application_portal_url);
      if (!v.ok) { rejected.push(`${c.title}: ${v.reason}`); continue; }
      const finalLink = normLink(v.finalUrl || c.application_portal_url);
      if (links.has(finalLink)) { rejected.push(`${c.title}: duplicate`); continue; }

      const { data: rec, error } = await supabase.from("agrofund_opportunities").insert({
        fingerprint: fp,
        organisation_name: c.organisation_name,
        title: c.title,
        category: c.category,
        funding_amount: c.funding_amount ?? 0,
        currency: c.currency || "USD",
        eligible_countries: c.eligible_countries,
        eligibility_requirements: c.eligibility_requirements,
        required_documents: c.required_documents,
        deadline: c.deadline ? new Date(c.deadline).toISOString() : null,
        official_application_link: c.application_portal_url,
        status: "pending_review",
        is_published: false,
        eligibility_assessment: c.eligibility_assessment,
        eligibility_reasons: c.why_agroclimate_fits,
        relevance_score: Math.max(0, Math.min(100, c.relevance_score || 0)),
        is_unclear_unverified: !c.deadline || c.funding_amount == null,
        unclear_details: [!c.deadline && "No fixed deadline found (rolling or unpublished).", c.funding_amount == null && "Funding amount not stated."].filter(Boolean).join(" ") || null,
        missing_info_flags: [!c.deadline && "deadline", c.funding_amount == null && "funding_amount"].filter(Boolean),
        source_url: c.source_url || c.application_portal_url,
        source_evidence_summary: `Application portal checked live on ${now.toISOString().slice(0, 10)} and shows an open application entry point.`,
        source_snippet: v.snippet?.slice(0, 500),
        source_credibility_score: 80,
        discovery_week: week,
        portal_verified_at: now.toISOString(),
      }).select("id").single();

      if (error) { rejected.push(`${c.title}: ${error.message}`); continue; }
      fps.add(fp); links.add(link); links.add(finalLink);
      inserted++;

      await supabase.from("agrofund_application_trackers").insert({
        opportunity_id: rec.id, stage: "not_applied", internal_notes: "Discovered by Dipa weekly funding scout.",
      });
      await supabase.from("agrofund_notifications").insert({
        opportunity_id: rec.id, type: "new_opportunity",
        title: `New open portal: ${c.title}`,
        message: `${c.organisation_name} is accepting applications. Sent to Pending Review.`,
        notification_key: `new_opp_${rec.id}`,
      });
    }

    const shortfall = remaining - inserted;
    const log = await finish({
      status: "success",
      opportunities_found: candidates.length,
      new_inserted: inserted,
      records_updated: 0,
      error_message: shortfall > 0
        ? `${inserted} of ${remaining} remaining weekly slots filled; only portals verified as open were accepted. Skipped: ${rejected.slice(0, 12).join("; ")}`
        : null,
    });
    return json({
      success: true,
      summary: { week, refreshType, totalFetched: candidates.length, newInserted: inserted, weeklyRemaining: remaining - inserted, recordsUpdated: 0, errors: [], lastSuccessfulRefresh: new Date().toISOString(), nextScheduledRefresh: nextMonday.toISOString() },
      refreshLog: log,
    });
  } catch (err) {
    const status = err instanceof GatewayError ? err.status : 500;
    const msg = status === 402 ? "AI credits are exhausted; weekly discovery is paused until credits are added."
      : status === 429 ? "Discovery is rate limited; it will try again on the next run."
      : (err as Error).message || "Discovery failed";
    await finish({ status: "error", error_message: msg });
    return json({ error: msg }, status >= 400 && status < 600 ? status : 500);
  }
});
