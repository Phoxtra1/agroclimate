import { Destination, LatLng } from "./types";

export class DestinationService {
  parseCoords(text: string): LatLng | null {
    const m = text.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  }

  isAtCurrentLocation(dest: LatLng, current: LatLng, thresholdMeters = 10): boolean {
    const dist = this.haversineDist(dest.lat, dest.lon, current.lat, current.lon);
    return dist <= thresholdMeters;
  }

  async fetchSuggestions(query: string): Promise<Destination[]> {
    if (!query || query.trim().length < 3) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const json = await res.json();
      if (!Array.isArray(json)) return [];
      return json.map((item: any) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        label: item.display_name,
      }));
    } catch {
      return [];
    }
  }

  async geocode(text: string, currentLoc?: LatLng): Promise<Destination | null> {
    const coords = this.parseCoords(text);
    if (coords) {
      if (currentLoc && this.isAtCurrentLocation(coords, currentLoc)) {
        throw new Error("Destination cannot be set to your exact current location. Please select another coordinate.");
      }
      return {
        lat: coords.lat,
        lon: coords.lon,
        label: `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
      };
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      text
    )}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;

    const lat = parseFloat(json[0].lat);
    const lon = parseFloat(json[0].lon);

    if (currentLoc && this.isAtCurrentLocation({ lat, lon }, currentLoc)) {
      throw new Error("Destination cannot be set to your exact current location. Please select another location.");
    }

    return {
      lat,
      lon,
      label: json[0].display_name,
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
