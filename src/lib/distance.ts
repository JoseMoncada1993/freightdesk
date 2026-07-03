// Offline mileage estimation from US ZIP codes.
// Matches each ZIP to its 3-digit ZIP zone (ZIP3) centroid, computes the
// great-circle distance (Haversine), then applies a road-circuity factor.
// No network/geocoding API required — mirrors FreightDesk_Mileage_Calculator.xlsx.
import { ZIP3_CENTROIDS } from "./zip3Centroids";

// Truck road miles typically run 15–20% longer than straight-line distance.
// 1.20 is a conservative default so quotes don't come in low.
export const DEFAULT_ROAD_FACTOR = 1.2;
const EARTH_RADIUS_MI = 3958.8;

export interface ZipPoint {
  zip3: string;
  lat: number;
  lon: number;
  city: string;
  state: string;
}

export interface DistanceResult {
  origin: ZipPoint;
  destination: ZipPoint;
  straightMiles: number;
  roadMiles: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Normalize any input to a 3-digit ZIP zone, preserving leading zeros. */
export function zip3Of(zip: string | number | null | undefined): string | null {
  if (zip == null) return null;
  const digits = String(zip).trim().replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.slice(0, 3);
}

/** Look up the centroid for a ZIP (full or 3-digit). Returns null if unknown. */
export function lookupZip(zip: string | number | null | undefined): ZipPoint | null {
  const key = zip3Of(zip);
  if (!key) return null;
  const rec = ZIP3_CENTROIDS[key];
  if (!rec) return null;
  const [lat, lon, city, state] = rec;
  return { zip3: key, lat, lon, city, state };
}

/** Great-circle distance in miles between two points. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const cos =
    Math.sin(toRad(lat1)) * Math.sin(toRad(lat2)) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  // Clamp to the valid acos domain to avoid NaN on identical/near points.
  return EARTH_RADIUS_MI * Math.acos(Math.min(1, Math.max(-1, cos)));
}

/**
 * Estimate road miles between two ZIP codes. Returns null if either ZIP's
 * zone is unknown (e.g. PO-box-only or military ZIPs).
 */
export function estimateMiles(
  originZip: string | number | null | undefined,
  destZip: string | number | null | undefined,
  roadFactor: number = DEFAULT_ROAD_FACTOR,
): DistanceResult | null {
  const origin = lookupZip(originZip);
  const destination = lookupZip(destZip);
  if (!origin || !destination) return null;
  const straightMiles = haversineMiles(
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon,
  );
  return {
    origin,
    destination,
    straightMiles: Math.round(straightMiles * 10) / 10,
    roadMiles: Math.round(straightMiles * roadFactor),
  };
}

// Default pricing assumptions (mirror the Excel Quote Calculator).
export const DEFAULT_RATE_PER_MILE = 2.5;
export const DEFAULT_FUEL_PCT = 0.18;
export const DEFAULT_MIN_CHARGE = 350;

export interface QuoteInput {
  ratePerMile: number;
  fuelPct: number; // decimal, e.g. 0.18 for 18%
  minCharge: number;
}

export interface QuoteResult {
  lineHaul: number;
  fuel: number;
  subtotal: number;
  quote: number;
}

/** Build a freight quote from road miles: rate/mile → line haul → fuel → floor at minimum. */
export function estimateQuote(roadMiles: number, input: QuoteInput): QuoteResult {
  const lineHaul = roadMiles * input.ratePerMile;
  const fuel = lineHaul * input.fuelPct;
  const subtotal = lineHaul + fuel;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    lineHaul: round2(lineHaul),
    fuel: round2(fuel),
    subtotal: round2(subtotal),
    quote: round2(Math.max(subtotal, input.minCharge)),
  };
}
