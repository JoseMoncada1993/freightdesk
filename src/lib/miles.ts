// src/lib/miles.ts
// Zip-to-zip distance estimate using a bundled zip-centroid lookup + haversine.
// No external API / billing required. A real maps key can replace this later
// for exact road miles. Falls back to a 3-digit ZIP prefix centroid, then null.

// Centroid latitude/longitude for common US ZIP codes and ZIP3 prefixes.
// Full 5-digit entries take priority; 3-digit prefixes are regional fallbacks.
const ZIP5: Record<string, [number, number]> = {
  "78550": [26.1906, -97.6961], // Harlingen, TX
  "33619": [27.9472, -82.3686], // Tampa, FL
  "83404": [43.4666, -111.9833], // Idaho Falls, ID
  "95828": [38.4793, -121.4399], // Sacramento, CA
  "78041": [27.5306, -99.4803], // Laredo, TX
  "77092": [29.8246, -95.4811], // Houston, TX
  "78503": [26.2034, -98.23], // McAllen, TX
};

// Regional centroids by 3-digit ZIP prefix (broad US coverage).
const ZIP3: Record<string, [number, number]> = {
  "335": [27.95, -82.46],
  "336": [27.95, -82.46],
  "331": [25.78, -80.21],
  "330": [25.78, -80.21],
  "100": [40.71, -74.0],
  "101": [40.71, -74.0],
  "102": [40.71, -74.0],
  "300": [33.75, -84.39],
  "303": [33.75, -84.39],
  "606": [41.85, -87.65],
  "600": [41.85, -87.65],
  "750": [32.78, -96.8],
  "752": [32.78, -96.8],
  "770": [29.76, -95.37],
  "772": [29.76, -95.37],
  "785": [27.53, -99.49],
  "780": [26.19, -97.7],
  "900": [34.05, -118.24],
  "902": [34.05, -118.24],
  "958": [38.58, -121.49],
  "956": [38.58, -121.49],
  "981": [47.61, -122.33],
  "980": [47.61, -122.33],
  "850": [33.45, -112.07],
  "852": [33.45, -112.07],
  "833": [43.49, -112.03],
  "787": [30.27, -97.74],
  "782": [29.42, -98.49],
};

function lookup(zip?: string | null): [number, number] | null {
  if (!zip) return null;
  const z = String(zip).trim();
  if (ZIP5[z]) return ZIP5[z];
  const p3 = z.slice(0, 3);
  if (ZIP3[p3]) return ZIP3[p3];
  return null;
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const ROAD_FACTOR = 1.17;

export function estimateMiles(
  originZip?: string | null,
  destZip?: string | null
): number | null {
  const a = lookup(originZip);
  const b = lookup(destZip);
  if (!a || !b) return null;
  const gc = haversineMiles(a, b);
  return Math.round(gc * ROAD_FACTOR);
}

export function suggestedTotal(
  miles?: number | null,
  ratePerMile?: number | null
): number | null {
  if (miles == null || ratePerMile == null) return null;
  return Math.round(miles * ratePerMile * 100) / 100;
}

export function knownZip(zip?: string | null): boolean {
  return lookup(zip) != null;
}
