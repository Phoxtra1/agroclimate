export function createHarvestIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `harvest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildHarvestPhotoPath(userId: string, idempotencyKey: string, photoIndex: number, extension: string): string {
  const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${userId}/harvest-${safeKey}-${photoIndex}.${safeExtension}`;
}
