// Leaflet map for the route optimizer. Renders numbered stop markers and the
// route polyline (in order, closing the loop on round trips). Uses free
// OpenStreetMap tiles — no API key. Driven imperatively to avoid extra deps.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Stop } from "@/lib/routeOptimize";

function numberedIcon(n: number, isStart: boolean) {
  const bg = isStart ? "#16a34a" : "#2563eb";
  return L.divIcon({
    className: "",
    html:
      `<div style="background:${bg};color:#fff;width:24px;height:24px;border-radius:50%;` +
      `display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;` +
      `border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function RouteMap({ stops, roundTrip }: { stops: Stop[]; roundTrip: boolean }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([39.5, -98.35], 4); // US center
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers + route when stops change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (stops.length === 0) {
      map.setView([39.5, -98.35], 4);
      return;
    }
    const pts: [number, number][] = stops.map((s) => [s.lat, s.lon]);
    stops.forEach((s, i) => {
      L.marker([s.lat, s.lon], { icon: numberedIcon(i + 1, i === 0) })
        .bindPopup(`<b>${i + 1}. ${s.label}</b><br/>${s.city}, ${s.state} ${s.zip}`)
        .addTo(layer);
    });
    const line = roundTrip && stops.length > 1 ? [...pts, pts[0]] : pts;
    if (line.length > 1) {
      L.polyline(line, { color: "#2563eb", weight: 3, opacity: 0.8 }).addTo(layer);
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 12 });
    // The container may have resized (flex layout); nudge Leaflet to recalc.
    setTimeout(() => map.invalidateSize(), 0);
  }, [stops, roundTrip]);

  return <div ref={elRef} className="h-[520px] w-full rounded-xl border border-slate-200 z-0" />;
}
