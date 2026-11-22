import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { disabledWeatherSmsResponse } from "./disabled.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  // Intentionally public, side-effect-free status response: never processes input,
  // accesses recipients or invokes a messaging provider.
  return disabledWeatherSmsResponse(corsHeaders);
});
