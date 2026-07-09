// Multi-stop route optimization, fully offline. Geocodes stops from US ZIPs via
// the ZIP3 centroid table, estimates road miles (great-circle × road factor),
// and orders stops with nearest-neighbor + 2-opt to minimize total distance.
import { lookupZip, haversineMiles, DEFAULT_ROAD_FACTOR } from "@/lib/distance";

export interface Stop {
  id: string;
  label: string;
  zip: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
}

let seq = 0;
export const newStopId = () => `s${Date.now()}_${seq++}`;

/** Build a Stop from a ZIP (and optional label). Returns null if ZIP unknown. */
export function geocodeStop(zip: string, label?: string): Stop | null {
  const p = lookupZip(zip);
  if (!p) return null;
  return {
    id: newStopId(),
    label: (label ?? "").trim() || `${p.city}, ${p.state}`,
    zip: String(zip).trim(),
    city: p.city,
    state: p.state,
    lat: p.lat,
    lon: p.lon,
  };
}

export const legMiles = (a: Stop, b: Stop, roadFactor = DEFAULT_ROAD_FACTOR) =>
  Math.round(haversineMiles(a.lat, a.lon, b.lat, b.lon) * roadFactor);

/** Per-leg miles for an ordered list (+ return leg when round trip). */
export function legsFor(order: Stop[], roundTrip: boolean, roadFactor = DEFAULT_ROAD_FACTOR): number[] {
  const legs: number[] = [];
  for (let i = 0; i < order.length - 1; i++) legs.push(legMiles(order[i], order[i + 1], roadFactor));
  if (roundTrip && order.length > 1) legs.push(legMiles(order[order.length - 1], order[0], roadFactor));
  return legs;
}

export const totalMiles = (order: Stop[], roundTrip: boolean, roadFactor = DEFAULT_ROAD_FACTOR) =>
  legsFor(order, roundTrip, roadFactor).reduce((a, b) => a + b, 0);

function distMatrix(stops: Stop[], roadFactor: number): number[][] {
  const n = stops.length;
  const d = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const m = haversineMiles(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon) * roadFactor;
      d[i][j] = d[j][i] = m;
    }
  return d;
}

function pathCost(order: number[], d: number[][], roundTrip: boolean): number {
  let c = 0;
  for (let i = 0; i < order.length - 1; i++) c += d[order[i]][order[i + 1]];
  if (roundTrip && order.length > 1) c += d[order[order.length - 1]][order[0]];
  return c;
}

function nearestNeighbor(n: number, d: number[][]): number[] {
  const visited = new Array(n).fill(false);
  visited[0] = true;
  const order = [0];
  let cur = 0;
  for (let k = 1; k < n; k++) {
    let best = -1;
    let bd = Infinity;
    for (let j = 0; j < n; j++) if (!visited[j] && d[cur][j] < bd) { bd = d[cur][j]; best = j; }
    order.push(best);
    visited[best] = true;
    cur = best;
  }
  return order;
}

// 2-opt: repeatedly reverse a segment if it shortens the path. Stop 0 (the
// starting point) is held fixed.
function twoOpt(order: number[], d: number[][], roundTrip: boolean): number[] {
  let best = order.slice();
  let bestCost = pathCost(best, d, roundTrip);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const cost = pathCost(cand, d, roundTrip);
        if (cost + 1e-9 < bestCost) {
          best = cand;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return best;
}

export interface OptimizeResult {
  stops: Stop[];
  legs: number[];
  total: number;
}

/**
 * Order stops to minimize total road miles. The first stop stays the origin;
 * when roundTrip, the route returns to it. ≤2 stops are returned unchanged.
 */
export function optimizeRoute(
  stops: Stop[],
  roundTrip: boolean,
  roadFactor = DEFAULT_ROAD_FACTOR,
): OptimizeResult {
  if (stops.length <= 2) {
    return { stops: stops.slice(), legs: legsFor(stops, roundTrip, roadFactor), total: totalMiles(stops, roundTrip, roadFactor) };
  }
  const d = distMatrix(stops, roadFactor);
  const order = twoOpt(nearestNeighbor(stops.length, d), d, roundTrip);
  const ordered = order.map((i) => stops[i]);
  return { stops: ordered, legs: legsFor(ordered, roundTrip, roadFactor), total: totalMiles(ordered, roundTrip, roadFactor) };
}

/** Rough drive time (hours) at an average moving speed incl. stops overhead. */
export function driveHours(miles: number, avgMph = 50): number {
  return miles / avgMph;
}

export const fmtHours = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
};
