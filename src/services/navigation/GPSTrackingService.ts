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
        let speedKn = 0;
        let bearing = heading || 0;
        let isMoving = false;

        if (this.lastPosition) {
          const dt = (now - this.lastPosition.time) / 1000; // in seconds
          if (dt > 0.5) {
            const dist = this.haversineDist(this.lastPosition.lat, this.lastPosition.lon, lat, lon);
            const speedMps = dist / dt;
            speedKn = speedMps * 1.94384; // convert m/s to knots

            // Filter out minor indoor GPS drift (movement threshold > 0.7 m/s / 2.5 km/h)
            if (speedMps > 0.7) {
              isMoving = true;
              bearing = this.getBearing(this.lastPosition.lat, this.lastPosition.lon, lat, lon);
            }
          }
        } else if (speed !== null && speed > 0.7) {
          speedKn = speed * 1.94384;
          isMoving = true;
        }

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
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }
}
