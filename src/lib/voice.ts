/**
 * Shared voice-direction settings for AGNav.
 * Volume is persisted so it survives reloads and applies to every spoken
 * instruction (navigation controller + map page).
 */
const VOLUME_KEY = "agnav_voice_volume";
const ENABLED_KEY = "agnav_voice_enabled";

let volume = readNumber(VOLUME_KEY, 1);

function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
}

export function getVoiceVolume() {
  return volume;
}

export function setVoiceVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  }
}

export function getStoredVoiceEnabled(fallback = true) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(ENABLED_KEY);
  if (raw === null) return fallback;
  return raw === "true";
}

export function setStoredVoiceEnabled(enabled: boolean) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ENABLED_KEY, String(enabled));
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function speak(text: string, enabled: boolean) {
  if (!enabled || volume <= 0) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  u.volume = volume;
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
