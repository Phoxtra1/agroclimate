import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AT_SMS_URL = "https://api.africastalking.com/version1/messaging";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("AFRICASTALKING_API_KEY");
    if (!API_KEY) {
      throw new Error("AFRICASTALKING_API_KEY is not configured");
    }

    const { to, message, username } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'message'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default username for Africa's Talking (sandbox uses "sandbox")
    const atUsername = username || "agroclimate";

    // Format phone number for Ghana if needed
    const formattedTo = to.startsWith("+") ? to : `+233${to.replace(/^0/, "")}`;

    const params = new URLSearchParams();
    params.append("username", atUsername);
    params.append("to", formattedTo);
    params.append("message", message);

    const response = await fetch(AT_SMS_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "apiKey": API_KEY,
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    console.log("AT response status:", response.status, "body:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`SMS API returned non-JSON [${response.status}]: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(`SMS send failed [${response.status}]: ${responseText}`);
    }

    console.log("SMS sent successfully:", JSON.stringify(data));

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending SMS:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
