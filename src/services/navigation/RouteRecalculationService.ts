import { LatLng } from "./types";

export class RouteRecalculationService {
  /**
   * Calculates the minimum perpendicular distance from a current location to the route polyline.
   * If the distance is larger than the specified deviationThresholdMeters, returns true (off-route detected).
   */
  isOffRoute(
    current: LatLng,
    route: [number, number][],
    deviationThresholdMeters = 80
  ): { offRoute: boolean; closestSegmentIndex: number; minDistance: number } {
    if (route.length === 0) {
      return { offRoute: false, closestSegmentIndex: -1, minDistance: 0 };
    }

    let minDistance = Infinity;
    let closestSegmentIndex = -1;

    for (let i = 0; i < route.length; i++) {
      const dist = this.haversineDist(current.lat, current.lon, route[i][0], route[i][1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestSegmentIndex = i;
      }
    }

    // Determine if user has drifted beyond the allowed off-route threshold
    const offRoute = minDistance > deviationThresholdMeters;

    return {
      offRoute,
      closestSegmentIndex,
      minDistance,
    };
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
}
