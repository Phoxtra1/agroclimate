/**
 * Standalone Test Mode engine.
 *
 * Deliberately decoupled from any payment plan naming: the engine only knows
 * about generic feature keys. Entitlement resolution for the "off" state is
 * injected by the caller (see `useTestModeEntitlement`).
 */

export const TEST_MODE_STORAGE_KEY = "settings.testMode";
export const TEST_MODE_SETTINGS_KEY = "test_mode";
export const TEST_MODE_EVENT = "settings:testMode";

export interface TestModeState {
  /** Master switch. When true every feature check resolves to true. */
  enabled: boolean;
  /** Optional free-text note shown in the tester banner. */
  note?: string;
  /** ISO timestamp of the last change. */
  updatedAt?: string;
}

export const DEFAULT_TEST_MODE: TestModeState = { enabled: false };

export function readLocalTestMode(): TestModeState {
  try {
    const raw = localStorage.getItem(TEST_MODE_STORAGE_KEY);
    if (!raw) return DEFAULT_TEST_MODE;
    const parsed = JSON.parse(raw);
    if (typeof parsed === "boolean") return { enabled: parsed };
    return { ...DEFAULT_TEST_MODE, ...parsed, enabled: !!parsed?.enabled };
  } catch {
    return DEFAULT_TEST_MODE;
  }
}

export function writeLocalTestMode(state: TestModeState) {
  try {
    localStorage.setItem(TEST_MODE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — in-memory state still applies */
  }
  window.dispatchEvent(new CustomEvent(TEST_MODE_EVENT, { detail: state }));
}
