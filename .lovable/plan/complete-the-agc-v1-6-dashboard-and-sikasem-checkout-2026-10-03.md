# Complete the AGC V1.6 dashboard and Sikasem checkout

## Dashboard
- Replace the unchanged dashboard presentation with a live AgroClimate Intelligence summary derived only from the current weather response.
- Show the full seven-day forecast, including each provider forecast date and the latest observed/refreshed timestamp.
- Add a Proactive Alerts centre derived from live forecast thresholds, with clear severity, confidence, location, horizon, explanation, and recommended action.
- Show an honest unavailable/stale state instead of presenting sample weather as live when the weather service cannot respond.

## Sikasem payments
- Keep Sikasem as the only payment-method selector and preserve the existing subscription/product pages.
- Make Card selection transfer directly into Stripe's hosted card form, rather than exposing a raw payment link.
- Make Mobile Money initialize Paystack in a supported local currency and open its hosted Mobile Money checkout; return a clear provider-configuration message if the merchant account has no active Mobile Money channel.
- Preserve the existing verified-payment activation flow so selecting a method or returning from checkout never grants access by itself.

## Verification
- Deploy the updated payment functions.
- Check the preview at desktop and mobile widths, exercise both Sikasem selections while signed in, and confirm the dashboard renders seven forecast days and timestamped alert intelligence.
- Confirm the latest preview build log is clean.

## Technical details
- Extend the existing weather hook metadata rather than adding another weather API.
- Keep provider URLs server-generated and redirect through a validated `https` URL.
- Use existing semantic colors and controls; no product-page redesign or duplicate checkout UI.
