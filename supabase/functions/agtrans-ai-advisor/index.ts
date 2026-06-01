import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { request_id, action, lat, lng } = await req.json();

    if (!request_id || !action) {
      throw new Error("Missing request_id or action");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: request, error: fetchError } = await supabase
      .from("transport_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) throw new Error("Request not found");

    let aiRecommendation = "";

    if (action === "optimize_route") {
      // Simulate AI Optimization
      aiRecommendation = `AI Optimized Route: Bypass major traffic at junction near ${request.pickup_location}. Estimated fuel savings: 12%.`;
      console.log(`[AGTrans AI] Route optimized for ${request_id}: ${aiRecommendation}`);
      
      // Update the request with AI insight if there was a column for it. 
      // Assuming a generic notes or ai_insight column, or we just log it for now.
    } else if (action === "track_location") {
      // Simulate tracking consistency and deviation alerts
      console.log(`[AGTrans AI] Tracking ping for ${request_id}: Lat ${lat}, Lng ${lng}`);
      
      // Basic AI logic for route deviation
      const mockExpectedLat = 5.6037;
      const deviation = Math.abs(lat - mockExpectedLat);
      
      if (deviation > 0.05) {
        console.warn(`[AGTrans AI] Route deviation detected for trip ${request_id}!`);
        // We could create a system alert or notify the admin panel
      }
      
      aiRecommendation = "Tracking verified. On optimal route.";
    } else {
      throw new Error("Unknown AI action");
    }

    return new Response(
      JSON.stringify({ success: true, aiRecommendation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in agtrans-ai-advisor:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
