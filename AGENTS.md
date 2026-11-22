# Architecture rules

- Use one Sikasem payment-method selector and one Adesua entitlement flow; provider returns never grant access without server-side verification.
- Weather intelligence must use live or cached provider data and expose unavailable states instead of substituting sample forecasts; share client requests and provider cooldowns, preserve original cache timestamps, and withhold new weather decisions from stale evidence so upstream outages do not crash pages or generate fresh-looking alerts.
- Produce screening uses authenticated server-side image analysis; camera quality checks are capture aids, never food-safety measurements, and strip readings require kit-specific reference evidence.
- Satellite uses the shared geospatial registry and owner-scoped live field/alert subscriptions; acquisition times represent satellite passes, never a continuous live image feed.
- Satellite weather risk uses raw dated provider values at the settled map centre, with missing or stale evidence withheld; climate normals remain separate from current conditions.
- Device integration extends the existing shared gateway and optional adapters rather than introducing a second registry; keep server-derived ownership, receipt time and retry-safe event identities.
- Load the public landing page eagerly and wrap application startup in a recovery boundary so route-chunk or provider failures cannot leave an empty screen.
- Keep the resilient weather provider in the edge-function shared directory so both weather endpoints deploy with the same cache and rate-limit behavior.
- Alert rendering must not trigger SMS broadcasts; the disabled SMS endpoint returns a side-effect-free status for older clients until server-side consent, targeting and delivery controls exist.