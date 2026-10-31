import type { GeoPoint, RouteData, TravelMode } from "@/services/satellite/navigation";

export interface CachedNavigationRoute {
  id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  mode: TravelMode;
  route: RouteData;
  cachedAt: string;
  provider: string;
}

const DATABASE_NAME = "agroclimate-offline-navigation";
const STORE_NAME = "routes";
const DATABASE_VERSION = 1;

function routeId(origin: GeoPoint, destination: GeoPoint, mode: TravelMode) {
  const key = (point: GeoPoint) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
  return `${key(origin)}->${key(destination)}:${mode}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline route storage is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline route storage."));
  });
}

export async function cacheNavigationRoute(input: Omit<CachedNavigationRoute, "id" | "cachedAt">): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        ...input,
        id: routeId(input.origin, input.destination, input.mode),
        cachedAt: new Date().toISOString(),
      } satisfies CachedNavigationRoute);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not store offline route."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Offline route cache write was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function getCachedNavigationRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  mode: TravelMode,
): Promise<CachedNavigationRoute | null> {
  const database = await openDatabase();
  try {
    return await new Promise<CachedNavigationRoute | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(routeId(origin, destination, mode));
      request.onsuccess = () => resolve((request.result as CachedNavigationRoute | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read offline route cache."));
    });
  } finally {
    database.close();
  }
}

export function routeCacheAgeMinutes(route: CachedNavigationRoute, now = Date.now()): number {
  const captured = Date.parse(route.cachedAt);
  return Number.isFinite(captured) ? Math.max(0, Math.round((now - captured) / 60000)) : Number.POSITIVE_INFINITY;
}
