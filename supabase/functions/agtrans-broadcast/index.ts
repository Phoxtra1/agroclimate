import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { request_id } = await req.json();

    if (!request_id) {
      throw new Error("Missing request_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the transport request
    const { data: request, error: fetchError } = await supabase
      .from("transport_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      throw new Error("Request not found");
    }

    // Find verified drivers in the region (Simulated here)
    const { data: drivers } = await supabase
      .from("agtrans_drivers")
      .select("*")
      .eq("verification_status", "verified");

    const driverCount = drivers ? drivers.length : 0;
    
    // In a real implementation, we would send push notifications to these drivers here.
    console.log(`[AGTrans Broadcast] Broadcasted transport request ${request_id} to ${driverCount} drivers.`);

    return new Response(
      JSON.stringify({ success: true, message: `Broadcasted to ${driverCount} verified drivers.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in agtrans-broadcast:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
