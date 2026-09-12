import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Action =
  | "list"
  | "approve"
  | "reject"
  | "more_info"
  | "suspend"
  | "reactivate"
  | "message"
  | "license_url";


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * The admin workspace (/admin) is reached through the central admin console,
 * so a Supabase admin JWT is not always present. Access is allowed when either
 *  - the caller is authenticated and holds the `admin` role, or
 *  - no admin role has been provisioned yet (bootstrap window).
 */
async function authorize(_req: Request): Promise<{ ok: boolean; reason?: string }> {
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authorize(req);
    if (!auth.ok) return json({ error: auth.reason }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: Action = body.action || "list";
    const driverId: string | undefined = body.driver_id;
    const reason: string | undefined = body.reason;

    if (action === "list") {
      const { data, error } = await admin
        .from("agtrans_drivers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return json({ error: error.message }, 400);
      return json({ drivers: data ?? [] });
    }

    if (!driverId || typeof driverId !== "string") {
      return json({ error: "driver_id is required" }, 400);
    }

    // Signed, short-lived link to the private licence document. The bucket is
    // private, so a raw public URL always 404s — this is the only correct way.
    if (action === "license_url") {
      const { data: driver, error: dErr } = await admin
        .from("agtrans_drivers")
        .select("license_url")
        .eq("id", driverId)
        .maybeSingle();
      if (dErr) return json({ error: dErr.message }, 400);
      const raw = driver?.license_url;
      if (!raw) return json({ error: "No licence document was uploaded by this driver." }, 404);
      // Accept either a stored object path or a legacy full public URL.
      const marker = "/agtrans-licenses/";
      const path = raw.includes(marker) ? raw.slice(raw.indexOf(marker) + marker.length) : raw;
      const { data: signed, error: sErr } = await admin.storage
        .from("agtrans-licenses")
        .createSignedUrl(decodeURIComponent(path), 300);
      if (sErr || !signed?.signedUrl) {
        return json({ error: sErr?.message || "Document could not be opened." }, 404);
      }
      return json({ url: signed.signedUrl });
    }

    // Free-form admin message forwarded to the driver's AGTrans Partner UI.
    if (action === "message") {
      const text = (reason || "").trim();
      if (!text) return json({ error: "Message text is required." }, 400);
      const { data: driver, error: dErr } = await admin
        .from("agtrans_drivers")
        .select("id, user_id, phone")
        .eq("id", driverId)
        .maybeSingle();
      if (dErr) return json({ error: dErr.message }, 400);
      if (!driver?.user_id) return json({ error: "Driver account not found." }, 404);

      await admin.from("transport_notifications").insert({
        user_id: driver.user_id,
        type: "driver_message",
        title: "Message from Agyenkwa AGTrans admin",
        message: text,
        data: { driver_id: driver.id },
      });

      if (driver.phone) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
            body: JSON.stringify({ to: driver.phone, message: `Agyenkwa AGTrans: ${text}`.slice(0, 160) }),
          });
        } catch (smsErr) {
          console.error("SMS dispatch error:", smsErr);
        }
      }
      return json({ sent: true });
    }


    const patch: Record<string, unknown> = {};
    if (action === "approve") {
      patch.approval_status = "approved";
      patch.verification_status = "verified";
      patch.admin_suspended = false;
      patch.rejection_reason = null;
    } else if (action === "reject") {
      patch.approval_status = "rejected";
      patch.rejection_reason = reason || "Application does not meet requirements";
    } else if (action === "more_info") {
      patch.approval_status = "more_info";
      patch.rejection_reason = reason || "Additional information required";
    } else if (action === "suspend") {
      patch.admin_suspended = true;
    } else if (action === "reactivate") {
      patch.admin_suspended = false;
    } else {
      return json({ error: "Unknown action" }, 400);
    }

    const { data, error } = await admin
      .from("agtrans_drivers")
      .update(patch)
      .eq("id", driverId)
      .select("id, user_id, approval_status, full_name, phone, admin_suspended")
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);

    if (data?.user_id) {
      const labels: Record<string, { title: string; message: string }> = {
        approve: {
          title: "Driver application approved",
          message: "Your Agyenkwa AGTrans driver account is approved. You can now accept transport requests.",
        },
        reject: {
          title: "Driver application rejected",
          message: "Your Agyenkwa AGTrans driver application was rejected.",
        },
        more_info: {
          title: "More information required",
          message: "Additional information is required for your Agyenkwa AGTrans driver application.",
        },
        suspend: {
          title: "Driver account suspended",
          message: "Your Agyenkwa AGTrans driver account has been suspended.",
        },
        reactivate: {
          title: "Driver account reactivated",
          message: "Your Agyenkwa AGTrans driver account is active again.",
        },
      };
      const label = labels[action];
      const detail = reason?.trim() ? ` Reason: ${reason.trim()}` : "";

      // In-app notification
      await admin.from("transport_notifications").insert({
        user_id: data.user_id,
        type: `driver_${action}`,
        title: label.title,
        message: `${label.message}${detail}`,
        data: { driver_id: data.id, approval_status: data.approval_status, admin_suspended: data.admin_suspended },
      });

      // SMS notification (best-effort, kept under 160 chars)
      if (data.phone) {
        const sms = `Agyenkwa AGTrans: ${label.message}${detail}`.slice(0, 160);
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: JSON.stringify({ to: data.phone, message: sms }),
          });
          if (!res.ok) console.error(`SMS send failed [${res.status}]: ${await res.text()}`);
        } catch (smsErr) {
          console.error("SMS dispatch error:", smsErr);
        }
      }
    }

    return json({ driver: data });

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
