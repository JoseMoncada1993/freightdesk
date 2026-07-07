// Diesel price via the /api/diesel Pages Function (server-side EIA proxy).
// The EIA key lives as a runtime secret on the server, never in the client bundle.
import { useEffect, useState, useCallback } from "react";

type Region = {
  name: string;
  price: number;
};

type DieselData = {
  price: number;
  period: string;
  units: string;
  regions: Region[];
};

function fmtWeek(period: string): string {
  const d = new Date(period + "T00:00:00");
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DieselWidget() {
  const [data, setData] = useState<DieselData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/diesel");
      const json = await res.json();

      if (!res.ok || (json && json.error)) {
        throw new Error(String((json && json.error) || "HTTP " + res.status));
      }

      const value = Number(json.price);
      if (Number.isNaN(value)) {
        throw new Error("No diesel price data returned.");
      }

      const regions: Region[] = Array.isArray(json.regions)
        ? json.regions
            .map((r: { name: unknown; price: unknown }) => ({
              name: String(r.name),
              price: Number(r.price),
            }))
            .filter((r: Region) => !Number.isNaN(r.price))
        : [];

      setData({
        price: value,
        period: String(json.period),
        units: String(json.units || "$/GAL"),
        regions,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load diesel price."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold mb-4">U.S. Diesel Prices</h3>

      {loading && (
        <div className="animate-pulse">
          <div className="h-9 w-32 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-48 bg-slate-100 rounded" />
        </div>
      )}

      {!loading && error && (
        <div>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={load}
            className="mt-3 text-xs font-medium text-brand hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              ${data.price.toFixed(3)}
            </span>
            <span className="text-sm text-slate-500">/ gal</span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            National average &middot; week of {fmtWeek(data.period)}
          </p>

          {(() => {
            const byRegion = data.regions.filter((r) => r.name !== "U.S. average");
            if (byRegion.length === 0) return null;
            return (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">By region</p>
                <ul className="space-y-1.5">
                  {byRegion.map((r) => {
                    const diff = r.price - data.price;
                    // Higher-than-national diesel is worse for a carrier → amber; lower → emerald.
                    const color =
                      Math.abs(diff) < 0.005
                        ? "text-slate-400"
                        : diff > 0
                          ? "text-amber-600"
                          : "text-emerald-600";
                    return (
                      <li key={r.name} className="flex items-baseline justify-between text-sm">
                        <span className="text-slate-600">{r.name}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="font-semibold text-slate-800 tabular-nums">
                            ${r.price.toFixed(3)}
                          </span>
                          <span className={`text-xs tabular-nums ${color}`}>
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(3)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
        </div>
      )}

      <p className="text-slate-400 text-xs mt-3">
        Source: U.S. DOE/EIA weekly on-highway diesel prices &middot; vs. national avg
      </p>
    </div>
  );
}
