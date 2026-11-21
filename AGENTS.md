# Architecture rules

- Use one Sikasem payment-method selector and one Adesua entitlement flow; provider returns never grant access without server-side verification.
- Weather intelligence must use live or cached provider data and expose unavailable states instead of substituting sample forecasts.
- Produce screening uses authenticated server-side image analysis; camera quality checks are capture aids, never food-safety measurements, and strip readings require kit-specific reference evidence.
- Satellite uses the shared geospatial registry and owner-scoped live field/alert subscriptions; acquisition times represent satellite passes, never a continuous live image feed.
- Satellite weather risk uses raw dated provider values at the settled map centre, with missing or stale evidence withheld; climate normals remain separate from current conditions.
- Device integration extends the existing shared gateway and optional adapters rather than introducing a second registry; keep server-derived ownership, receipt time and retry-safe event identities.
- Load the public landing page eagerly and wrap application startup in a recovery boundary so route-chunk or provider failures cannot leave an empty screen.