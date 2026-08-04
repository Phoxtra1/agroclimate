import { LatLng } from "./types";

export interface GPSUpdate {
  coords: LatLng;
  speedKn: number;
  bearing: number;
  isMoving: boolean;
  accuracy?: number;
}

export class GPSTrackingService {
  private watchId: number | null = null;
  private lastPosition: { lat: number; lon: number; time: number } | null = null;
  private smoothedSpeedMps = 0;

  startTracking(
    onUpdate: (update: GPSUpdate) => void,
    onError?: (error: GeolocationPositionError) => void
  ): void {
    if (this.watchId !== null) {
      this.stopTracking();
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      console.warn("Geolocation API not available in this environment.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, heading, speed, accuracy } = pos.coords;
        const now = Date.now();
        let measuredSpeedMps = speed !== null && Number.isFinite(speed) ? Math.max(0, speed) : 0;
        let bearing = heading || 0;
        let isMoving = false;

        if (this.lastPosition) {
          const dt = (now - this.lastPosition.time) / 1000; // in seconds
          if (dt > 0.5) {
            const dist = this.haversineDist(this.lastPosition.lat, this.lastPosition.lon, lat, lon);
            const calculatedSpeedMps = dist / dt;
            // Device speed is usually less noisy than point-to-point speed. Ignore
            // displacement-derived spikes when the reported GPS accuracy is poor.
            if (speed === null || !Number.isFinite(speed)) {
              measuredSpeedMps = accuracy <= 50 ? calculatedSpeedMps : 0;
            }

            // Filter out minor indoor GPS drift (movement threshold > 0.7 m/s / 2.5 km/h)
            if (measuredSpeedMps > 0.7 && accuracy <= 50 && dist >= Math.max(3, accuracy * 0.2)) {
              isMoving = true;
              bearing = this.getBearing(this.lastPosition.lat, this.lastPosition.lon, lat, lon);
            }
          }
        } else if (measuredSpeedMps > 0.7 && accuracy <= 50) {
          isMoving = true;
        }

        const smoothing = isMoving ? 0.28 : 0.12;
        this.smoothedSpeedMps += smoothing * (measuredSpeedMps - this.smoothedSpeedMps);
        if (!isMoving && this.smoothedSpeedMps < 0.35) this.smoothedSpeedMps = 0;
        const speedKn = this.smoothedSpeedMps * 1.94384;

        this.lastPosition = { lat, lon, time: now };

        onUpdate({
          coords: { lat, lon },
          speedKn,
          bearing,
          isMoving,
          accuracy,
        });
      },
      (err) => {
        if (onError) onError(err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0, // No cached locations
        timeout: 5000,
      }
    );
  }

  stopTracking(): void {
    if (this.watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.lastPosition = null;
    this.smoothedSpeedMps = 0;
  }

  private haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }
}
