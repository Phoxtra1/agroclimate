import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SETTINGS_KEY = "test_mode";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const readState = async () => {
    const { data } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      enabled: !!v.enabled,
      note: (v.note as string) ?? null,
      updatedAt: (v.updated_at as string) ?? null,
    };
  };

  try {
    let action = "get";
    let enabled = false;
    let note: string | undefined;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      action = typeof body.action === "string" ? body.action : "get";
      enabled = !!body.enabled;
      note = typeof body.note === "string" ? body.note.slice(0, 300) : undefined;
    }

    if (action !== "set") return json({ state: await readState() });

    // --- write path ---
    // Test Mode bypasses paid-feature gates globally. Only a server-verified
    // administrator may change it; never trust client metadata or localStorage.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\\s+/i, "").trim();
    if (!token) return json({ error: "Authentication required." }, 401);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const actorId = userData?.user?.id;
    if (userError || !actorId) return json({ error: "A valid signed-in session is required." }, 401);

    const { data: adminRole, error: roleError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", actorId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) return json({ error: "Administrator permissions could not be verified." }, 500);
    if (!adminRole) return json({ error: "Administrator permission is required to change Test Mode." }, 403);

    const value = {
      enabled,
      note: note ?? null,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    };

    const { error: upsertErr } = await admin
      .from("system_settings")
      .upsert({ key: SETTINGS_KEY, value, updated_by: actorId }, { onConflict: "key" });
    if (upsertErr) return json({ error: upsertErr.message }, 500);

    return json({ state: await readState() });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
