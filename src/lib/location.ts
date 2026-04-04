export interface ResolvedLocation {
  community: string;
  district: string;
  region: string;
  country: string;
  locationName: string;
}

function clean(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function pickFirst(values: Array<string | null | undefined>) {
  return values.map(clean).find(Boolean) ?? "";
}

export function buildLocationName(location: {
  community?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
}) {
  const community = clean(location.community);
  const district = clean(location.district);
  const region = clean(location.region);

  if (district && region) return `${district}, ${region}`;
  if (district) return district;
  if (community && region) return `${community}, ${region}`;
  if (community) return community;
  if (region) return region;
  return clean(location.country) || "Your Location";
}

export async function reverseGeocodeLocation(lat: number, lon: number): Promise<ResolvedLocation> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1&namedetails=1`,
    {
      headers: {
        "Accept": "application/json",
        "User-Agent": "AgroClimate/1.0",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Reverse geocoding failed with ${res.status}`);
  }

  const data = await res.json();
  const addr = data.address || {};

  const community = pickFirst([
    addr.suburb,
    addr.neighbourhood,
    addr.quarter,
    addr.hamlet,
    addr.village,
    addr.locality,
    addr.town,
    addr.city,
  ]);

  const district = pickFirst([
    addr.municipality,
    addr.city_district,
    addr.state_district,
    addr.county,
    addr.city,
    addr.town,
  ]);

  const region = pickFirst([addr.state, addr.region]);
  const country = pickFirst([addr.country]) || "Ghana";

  return {
    community,
    district,
    region,
    country,
    locationName: buildLocationName({ community, district, region, country }),
  };
}