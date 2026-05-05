// AgroClimate version control
// Update this single source of truth to globally update version across the platform.
// - Minor updates (feature additions): bump to 1.1, 1.2 ...
// - Major updates (system upgrades like a new AI engine): bump to 2.0
export const APP_VERSION = "1.2";
export const APP_VERSION_LABEL = `AGC V${APP_VERSION}`;

export const WHATS_NEW: { version: string; title: string; items: string[] } = {
  version: APP_VERSION,
  title: `What's New in ${APP_VERSION_LABEL}`,
  items: [
    "AGNav — interactive water-transport map for the Volta basin with SOS",
    "Odeneho AI Intelligence Layer — provider abstraction & risk scoring engine",
    "Market Link live chat, Negotiate and Pre-Order fully functional",
    "Buyer order edit/delete reflects instantly on dashboard listings",
    "Post-Harvest Tracker offline queue with conflict-safe sync",
  ],
};
