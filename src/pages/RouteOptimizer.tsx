// Freight Route Optimizer: build a multi-stop route from US ZIPs, optimize the
// stop order to minimize road miles, see it on a map, and save/load routes.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import RouteMap from "@/components/RouteMap";
import { inputCls } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import { useRoutes, useSaveRoute, useDeleteRoute } from "@/hooks/useRoutes";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import {
  geocodeStop,
  optimizeRoute,
  legsFor,
  totalMiles,
  driveHours,
  fmtHours,
  type Stop,
} from "@/lib/routeOptimize";
import type { SavedRoute } from "@/lib/types";

export default function RouteOptimizer() {
  const { can } = useAuth();
  const canWrite = can("routes");
  const { data: saved } = useRoutes();
  const saveRoute = useSaveRoute();
  const delRoute = useDeleteRoute();

  const [stops, setStops] = useState<Stop[]>([]);
  const [roundTrip, setRoundTrip] = useState(false);
  const [zip, setZip] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [routeId, setRouteId] = useState<number | null>(null);

  const legs = useMemo(() => legsFor(stops, roundTrip), [stops, roundTrip]);
  const total = useMemo(() => totalMiles(stops, roundTrip), [stops, roundTrip]);

  const addStop = () => {
    setErr("");
    if (!zip.trim()) return;
    const s = geocodeStop(zip, label);
    if (!s) {
      setErr(`ZIP "${zip}" isn't in the offline ZIP database. Try the 5-digit ZIP of a nearby town.`);
      return;
    }
    setStops((prev) => [...prev, s]);
    setZip("");
    setLabel("");
  };

  const move = (i: number, dir: -1 | 1) => {
    setStops((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeStop = (id: string) => setStops((prev) => prev.filter((s) => s.id !== id));

  const optimize = () => {
    if (stops.length < 3) return;
    setStops(optimizeRoute(stops, roundTrip).stops);
  };

  const clearAll = () => {
    setStops([]);
    setRouteId(null);
    setName("");
    setErr("");
  };

  const loadSaved = (r: SavedRoute) => {
    const s = Array.isArray(r.stops) ? (r.stops as unknown as Stop[]) : [];
    setStops(s);
    setRoundTrip(r.round_trip);
    setName(r.name);
    setRouteId(r.id);
    setErr("");
  };

  const persist = () => {
    if (!name.trim() || stops.length === 0) return;
    saveRoute.mutate(
      {
        id: routeId ?? undefined,
        name: name.trim(),
        stops: stops as unknown as SavedRoute["stops"],
        round_trip: roundTrip,
        total_miles: total,
      },
      { onSuccess: (id) => setRouteId(id as number) },
    );
  };

  const doExport = () => {
    let cum = 0;
    exportCsv(
      stops.map((s, i) => {
        const leg = i === 0 ? 0 : legs[i - 1];
        cum += leg;
        return {
          stop: i + 1, label: s.label, city: s.city, state: s.state, zip: s.zip,
          leg_miles: leg, cumulative_miles: cum,
        };
      }),
      "route",
    );
  };

  return (
    <div>
      <PageHeader
        title="Freight Route Optimizer"
        subtitle="Add stops by ZIP, optimize the order to minimize road miles, and map the route. Estimates are offline (ZIP-zone great-circle × road factor)."
        action={<button onClick={doExport} {...exportButtonProps(stops.length)}>Export CSV</button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">ZIP</label>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStop()}
                  placeholder="90262"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Label (optional)</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStop()}
                  placeholder="Customer DC"
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <button onClick={addStop} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Add stop
                </button>
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="rounded border-slate-300" />
                Round trip (return to start)
              </label>
              <button
                onClick={optimize}
                disabled={stops.length < 3}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Optimize order
              </button>
              {stops.length > 0 && (
                <button onClick={clearAll} className="text-sm font-medium text-slate-500 hover:underline">Clear</button>
              )}
            </div>
          </div>

          {/* Summary */}
          {stops.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg bg-slate-800 px-4 py-2 text-white">
                <div className="text-xs text-slate-300">Total</div>
                <div className="text-lg font-bold">{total.toLocaleString()} mi</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2">
                <div className="text-xs text-slate-500">Est. drive time</div>
                <div className="text-lg font-bold text-slate-800">{fmtHours(driveHours(total))}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2">
                <div className="text-xs text-slate-500">Stops</div>
                <div className="text-lg font-bold text-slate-800">{stops.length}</div>
              </div>
            </div>
          )}

          {/* Stop list */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {stops.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Add stops by ZIP to build a route.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {stops.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? "bg-emerald-600" : "bg-blue-600"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{s.label}</div>
                      <div className="text-xs text-slate-500">{s.city}, {s.state} {s.zip}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {i === 0 ? <span className="text-emerald-600 font-medium">Start</span> : `+${legs[i - 1]} mi`}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move up">↑</button>
                      <button onClick={() => move(i, 1)} disabled={i === stops.length - 1} className="rounded px-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Move down">↓</button>
                      <button onClick={() => removeStop(s.id)} className="rounded px-1.5 text-red-500 hover:bg-red-50" title="Remove">×</button>
                    </div>
                  </li>
                ))}
                {roundTrip && stops.length > 1 && (
                  <li className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-500">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-white">⤾</span>
                    <div className="flex-1">Return to {stops[0].label}</div>
                    <div>+{legs[legs.length - 1]} mi</div>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Save / load */}
          {canWrite && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Route name (e.g. Tue SoCal run)" className={inputCls} />
                <button
                  onClick={persist}
                  disabled={!name.trim() || stops.length === 0 || saveRoute.isPending}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {saveRoute.isPending ? "Saving…" : routeId ? "Update" : "Save route"}
                </button>
              </div>
              {(saved ?? []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-500">Saved routes</div>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {(saved ?? []).map((r) => (
                      <li key={r.id} className={`flex items-center justify-between px-3 py-2 text-sm ${r.id === routeId ? "bg-blue-50" : ""}`}>
                        <button onClick={() => loadSaved(r)} className="min-w-0 flex-1 text-left hover:underline">
                          <span className="font-medium text-slate-700">{r.name}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            {Array.isArray(r.stops) ? (r.stops as unknown[]).length : 0} stops · {r.total_miles ?? 0} mi
                          </span>
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete route "${r.name}"?`)) { delRoute.mutate(r.id); if (r.id === routeId) clearAll(); } }}
                          className="ml-3 text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: map */}
        <div>
          <RouteMap stops={stops} roundTrip={roundTrip} />
          <p className="mt-2 text-xs text-slate-400">
            Map data © OpenStreetMap contributors. Distances are ZIP-zone estimates for planning, not turn-by-turn navigation.
          </p>
        </div>
      </div>
    </div>
  );
}
