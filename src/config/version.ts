// AgroClimate version control
// Update this single source of truth to globally update version across the platform.
// - Minor updates (feature additions): bump to 1.1, 1.2 ...
// - Major updates (system upgrades like a new AI engine): bump to 2.0
export const APP_VERSION = "1.3";
export const APP_VERSION_LABEL = `AGC V${APP_VERSION}`;

export const WHATS_NEW: { version: string; title: string; items: string[] } = {
  version: APP_VERSION,
  title: `What's New in ${APP_VERSION_LABEL}`,
  items: [
    "AGNav 7-day flood-risk heatmap and real water-route navigation to farms",
    "Market Link Live Chat / Negotiate / Pre-Order open in dedicated dialog",
    "Buyers can edit and delete orders directly from the marketplace listing",
    "Marketplace gated — buyers must sign in to browse and trade",
    "Admin Overview real-time analytics with Today / 7d / 30d filter",
    "SPA deep-link fallback fix — /admin and other routes now load on refresh",
  ],
};
