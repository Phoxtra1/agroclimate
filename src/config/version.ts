// AgroClimate version control
// Update this single source of truth to globally update version across the platform.
// - Minor updates (feature additions): bump to 1.1, 1.2 ...
// - Major updates (system upgrades like a new AI engine): bump to 2.0
export const APP_VERSION = "1.4";
export const APP_VERSION_LABEL = "AGC v1.4";
export const APP_NAME = "AgroClimate";
export const APP_BRAND_LINE = "AgroClimate by Amineva Global";
export const APP_FOOTER = "AgroClimate by Amineva Global - © 2026 - All Rights Reserved.";

export const WHATS_NEW: { version: string; title: string; items: string[] } = {
  version: APP_VERSION,
  title: `What's New in ${APP_VERSION_LABEL}`,
  items: [
    "Centralized Agro-Climate Dataset Export system integrated in Admin Workspace",
    "Standardized Linked Lifecycle Data Export (Weather → Farm → Harvest → Market → Transport → Delivery)",
    "Anonymized multi-module CSV & JSON data export engine with custom date & region filters",
    "Comprehensive operational data coverage across Handlers, AGNav, AGTrans, Post-Harvest & Inventory",
    "Enterprise-grade privacy sanitization protecting user credentials and personal identifiers",
    "Seamless PWA parity & update triggers for offline & installed application environments",
  ],
};
