import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const atApiKey = Deno.env.get("AFRICASTALKING_API_KEY");
    
    if (!atApiKey) throw new Error("AFRICASTALKING_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { weatherData, location } = await req.json();

    if (!weatherData) throw new Error("weatherData is required");

    // Determine critical conditions
    const criticalAlerts: string[] = [];
    
    if (weatherData.rainProb > 70) {
      criticalAlerts.push(`⚠️ HEAVY RAIN ALERT: ${weatherData.rainProb}% rain probability in ${location}. Prepare drainage and protect stored harvest.`);
    }
    if (weatherData.tempHigh > 38) {
      criticalAlerts.push(`🔥 EXTREME HEAT: ${weatherData.tempHigh}°C expected in ${location}. Irrigate crops early morning/late evening. Keep livestock hydrated.`);
    }
    if (weatherData.wind > 40) {
      criticalAlerts.push(`💨 HIGH WIND WARNING: ${weatherData.wind} km/h winds in ${location}. Secure structures. No aerial spraying or drone flights.`);
    }
    if (weatherData.humidity > 90 && weatherData.tempHigh > 28) {
      criticalAlerts.push(`🦠 DISEASE RISK: High humidity (${weatherData.humidity}%) + heat in ${location}. Monitor for fungal infections on crops.`);
    }

    if (criticalAlerts.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No critical conditions detected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch users with registered phone numbers
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, phone, display_name, region")
      .not("phone", "is", null);

    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No users with phone numbers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const atUsername = "sandbox";
    const atUrl = atUsername === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    let sentCount = 0;
    const message = `AgroClimate Alert:\n${criticalAlerts.join("\n\n")}\n\nStay safe! - AgroClimate by Amineva`;

    for (const profile of profiles) {
      let phone = profile.phone?.trim();
      if (!phone) continue;

      // Format Ghana numbers
      if (phone.startsWith("0")) phone = "+233" + phone.slice(1);
      else if (!phone.startsWith("+")) phone = "+233" + phone;

      try {
        const body = new URLSearchParams({
          username: atUsername,
          to: phone,
          message: message,
        });

        const res = await fetch(atUrl, {
          method: "POST",
          headers: {
            "apiKey": atApiKey,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
          },
          body: body.toString(),
        });

        if (res.ok) sentCount++;
      } catch (e) {
        console.error(`Failed to send SMS to ${phone}:`, e);
      }
    }

    // Also create disaster_alerts records for the dashboard
    for (const alertMsg of criticalAlerts) {
      const alertType = alertMsg.includes("RAIN") ? "heavy_rain" 
        : alertMsg.includes("HEAT") ? "extreme_heat"
        : alertMsg.includes("WIND") ? "high_wind" 
        : "disease_risk";
      
      await supabase.from("disaster_alerts").insert({
        title: alertMsg.split(":")[0].replace(/[⚠️🔥💨🦠]/g, "").trim(),
        description: alertMsg,
        alert_type: alertType,
        severity: "critical",
        affected_regions: location ? [location] : [],
        active: true,
      });
    }

    return new Response(JSON.stringify({ sent: sentCount, alerts: criticalAlerts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
