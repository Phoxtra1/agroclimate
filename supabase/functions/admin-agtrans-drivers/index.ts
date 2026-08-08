import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Action = "list" | "approve" | "reject" | "more_info" | "suspend" | "reactivate";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * The admin workspace (/admin) is reached through the central Amineva console,
 * so a Supabase admin JWT is not always present. Access is allowed when either
 *  - the caller is authenticated and holds the `admin` role, or
 *  - no admin role has been provisioned yet (bootstrap window).
 */
async function authorize(req: Request): Promise<{ ok: boolean; reason?: string }> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (token) {
    const { data: userData } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (uid) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin");
      if (roles && roles.length > 0) return { ok: true };
    }
  }
  const { count } = await admin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if ((count ?? 0) === 0) return { ok: true };
  return { ok: false, reason: "Admin privileges required." };
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
      .select("id, user_id, approval_status")
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);

    if (data?.user_id && action !== "suspend" && action !== "reactivate") {
      await admin.from("transport_notifications").insert({
        user_id: data.user_id,
        type: `driver_${action}`,
        title: `Driver application ${action.replace("_", " ")}`,
        message: reason || `Your driver application status is now ${data.approval_status}.`,
      });
    }

    return json({ driver: data });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
