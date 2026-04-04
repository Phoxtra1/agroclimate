import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Backend environment is not configured correctly" }, 500);
    }

    // Verify the caller is authenticated
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { email, password, handler_name, handler_type, assigned_farm, farmer_id } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanName = typeof handler_name === "string" ? handler_name.trim() : "";
    const cleanType = handler_type === "supervisor" ? "supervisor" : "labourer";

    if (!cleanEmail || !password || !cleanName || !farmer_id) {
      return json({ error: "Missing required fields" }, 400);
    }

    if (typeof password !== "string" || password.length < 6) {
      return json({ error: "Temporary password must be at least 6 characters" }, 400);
    }

    if (caller.id !== farmer_id) {
      return json({ error: "Forbidden" }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingHandler } = await adminClient
      .from("handlers")
      .select("id")
      .eq("farmer_id", farmer_id)
      .eq("handler_name", cleanName)
      .maybeSingle();

    if (existingHandler) {
      return json({ error: "A handler with this name already exists for your farm" }, 409);
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: cleanName,
        is_handler: true,
        handler_type: cleanType,
        assigned_farm: assigned_farm || null,
      },
    });

    if (createError || !newUser?.user?.id) {
      return json({ error: createError?.message || "Unable to create handler account" }, 400);
    }

    const handlerUserId = newUser.user.id;

    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: handlerUserId,
      role: "handler",
    });

    if (roleError) {
      await adminClient.auth.admin.deleteUser(handlerUserId);
      return json({ error: `Unable to assign handler role: ${roleError.message}` }, 500);
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      user_id: handlerUserId,
      display_name: cleanName,
    }, { onConflict: "user_id" });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(handlerUserId);
      return json({ error: `Unable to create handler profile: ${profileError.message}` }, 500);
    }

    const { error: handlerError } = await adminClient.from("handlers").insert({
      user_id: handlerUserId,
      farmer_id,
      handler_name: cleanName,
      handler_type: cleanType,
      assigned_farm: assigned_farm || null,
    });

    if (handlerError) {
      await adminClient.auth.admin.deleteUser(handlerUserId);
      return json({ error: `Unable to create handler workspace: ${handlerError.message}` }, 500);
    }

    return json({ success: true, user_id: handlerUserId, email: cleanEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-handler failed:", message);
    return json({ error: message }, 500);
  }
});
