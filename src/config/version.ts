// AgroClimate version control
// Update this single source of truth to globally update version across the platform.
// - Minor updates (feature additions): bump to 1.1, 1.2 ...
// - Major updates (system upgrades like a new AI engine): bump to 2.0
export const APP_VERSION = "1.4";
export const APP_VERSION_LABEL = `AGRO V${APP_VERSION}`;
export const APP_NAME = "AgroClimate";
export const APP_BRAND_LINE = "AgroClimate by Amineva Global";
export const APP_FOOTER = "AgroClimate by Amineva Global - © 2026 - All Rights Reserved.";

export const WHATS_NEW: { version: string; title: string; items: string[] } = {
  version: APP_VERSION,
  title: `What's New in ${APP_VERSION_LABEL}`,
  items: [
    "Unified application identity under AgroClimate by Amineva Global",
    "AGTrans Partner dashboard stabilised — no more blank screen after loading",
    "Real-time driver alerts pop up instantly when new transport requests arrive",
    "Connection Diagnostics: rolling handshake/error log with CSV export drawer",
    "Aircraft Registry history timeline — connect/disconnect and protocol changes",
    "PWA icon, favicon and app name aligned under the AgroClimate identity",
  ],
};
