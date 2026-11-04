export function farmCodeFromInput(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.searchParams.get("code")?.trim() || "";
  } catch { /* legacy farm token */ }
  return trimmed;
}