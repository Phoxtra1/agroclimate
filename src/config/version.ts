// AgroClimate version control
// Update this single source of truth to globally update version across the platform.
// - Minor updates (feature additions): bump to 1.1, 1.2 ...
// - Major updates (system upgrades like a new AI engine): bump to 2.0
export const APP_VERSION = "1.0";
export const APP_VERSION_LABEL = `AGC V${APP_VERSION}`;

export const WHATS_NEW: { version: string; title: string; items: string[] } = {
  version: APP_VERSION,
  title: `What's New in ${APP_VERSION_LABEL}`,
  items: [
    "Proactive weather alerts delivered to dashboard, browser, and phone",
    "Real-time environmental risk analysis tied to your exact location",
    "Multi-sector coverage: crops, livestock, aquaculture and vegetables",
    "Post-Harvest Tracker — log harvests, monitor spoilage risk, get AI advice",
    "PWA install support — install AgroClimate on your device from the browser",
  ],
};
