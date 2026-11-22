/** Compatibility response for older clients; no recipient lookup or delivery occurs. */
export function disabledWeatherSmsResponse(headers: HeadersInit): Response {
  return new Response(JSON.stringify({
    status: "disabled",
    sent: 0,
    message: "Weather SMS broadcasts are disabled until recipient opt-in, regional targeting and delivery controls are implemented.",
  }), {
    status: 200,
    headers: { ...Object.fromEntries(new Headers(headers)), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}