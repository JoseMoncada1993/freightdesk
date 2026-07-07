// Diesel price via the /api/diesel Pages Function (server-side EIA proxy).
// The EIA key lives as a runtime secret on the server, never in the client bundle.
import { useEffect, useState, useCallback } from "react";

type DieselData = {
  price: number;
  period: string;
  units: string;
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

      setData({
        price: value,
        period: String(json.period),
        units: String(json.units || "$/GAL"),
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
        </div>
      )}

      <p className="text-slate-400 text-xs mt-3">
        Source: U.S. DOE/EIA weekly on-highway diesel average
      </p>
    </div>
  );
}
