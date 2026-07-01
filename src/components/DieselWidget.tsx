// Diesel price via EIA API v2 (rebuild to inline EIA env var)
import { useEffect, useState, useCallback } from "react";

type DieselData = {
  price: number;
  period: string;
  units: string;
};

const EIA_SERIES = "EMD_EPD2D_PTE_NUS_DPG";
const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/gnd/data/";

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

    const apiKey = import.meta.env.VITE_EIA_API_KEY as string | undefined;
    if (!apiKey) {
      setError("Diesel price is unavailable: missing EIA API key configuration.");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("frequency", "weekly");
    params.append("data[0]", "value");
    params.set("facets[series][]", EIA_SERIES);
    params.set("sort[0][column]", "period");
    params.set("sort[0][direction]", "desc");
    params.set("offset", "0");
    params.set("length", "1");
    params.set("api_key", apiKey);

    try {
      const res = await fetch(EIA_BASE + "?" + params.toString());
      const json = await res.json();

      if (!res.ok) {
        const msg =
          (json && json.error && (json.error.message || json.error.code)) ||
          "HTTP " + res.status;
        throw new Error(String(msg));
      }

      const rows =
        json && json.response && Array.isArray(json.response.data)
          ? json.response.data
          : [];
      const row = rows[0];
      const value = row ? Number(row.value) : NaN;

      if (!row || Number.isNaN(value)) {
        throw new Error("No diesel price data returned.");
      }

      setData({
        price: value,
        period: String(row.period),
        units: String(row.units || "$/GAL"),
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
