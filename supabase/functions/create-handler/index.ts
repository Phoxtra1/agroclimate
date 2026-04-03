import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is authenticated
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, password, handler_name, handler_type, assigned_farm, farmer_id } = await req.json();

    if (!email || !password || !handler_name || !farmer_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (caller.id !== farmer_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role to create the handler's auth account
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: handler_name, is_handler: true },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Assign handler role
    await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role: "handler",
    });

    // Create handler profile
    await adminClient.from("handlers").insert({
      user_id: newUser.user.id,
      farmer_id,
      handler_name,
      handler_type: handler_type || "labourer",
      assigned_farm: assigned_farm || null,
    });

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
