# Align dashboard and make AgroFund weekly

## Changes
- Match the desktop 7-day forecast card height to the complete left weather-and-advice column, while keeping the forecast list scrollable and mobile sizing natural.
- Set the browser and social title to exactly `AgroClimate-Agriculture & Climate Intelligence`.
- Replace AgroFund's repeated static refresh behavior with a weekly discovery run that accepts at most five verified, genuinely new opportunities.
- Deduplicate every discovery against all stored opportunity fingerprints and official links, and never recycle an older opportunity to fill the weekly quota.
- Keep the existing review, notification, audit, and real-time admin workflows intact.

## Reliability rules
- AgroFund will store the week in which each item was discovered and enforce uniqueness in the database, so retries cannot create repeats.
- A weekly run will target five new opportunities. If fewer than five verifiable opportunities are available, it will report the shortfall instead of inventing or repeating entries.
- Manual refreshes during the same week will only search for the remaining weekly quota.

## Technical details
- Update the dashboard grid sizing and forecast overflow behavior only at large-screen layouts.
- Add the minimal AgroFund persistence/scheduling migration, explicit table grants, and a server-side weekly quota check.
- Update the existing AgroFund function rather than creating a second funding pipeline.
- Verify typechecking, preview rendering, and the weekly deduplication path before completion.
