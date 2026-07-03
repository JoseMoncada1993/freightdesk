import { useMemo, useState } from "react";
import {
  estimateMiles,
  estimateQuote,
  DEFAULT_ROAD_FACTOR,
  DEFAULT_RATE_PER_MILE,
  DEFAULT_FUEL_PCT,
  DEFAULT_MIN_CHARGE,
} from "@/lib/distance";
import { useAddLoad } from "@/hooks/useAddLoad";
import type { LoadStatus } from "@/lib/types";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUSES: LoadStatus[] = ["quoted", "booked", "in_transit", "delivered", "cancelled"];

interface AddLoadFormProps {
  onClose: () => void;
}

export default function AddLoadForm({ onClose }: AddLoadFormProps) {
  const [ref, setRef] = useState("");
  const [originZip, setOriginZip] = useState("");
  const [destZip, setDestZip] = useState("");
  const [ratePerMile, setRatePerMile] = useState(String(DEFAULT_RATE_PER_MILE));
  const [fuelPct, setFuelPct] = useState(String(DEFAULT_FUEL_PCT * 100));
  const [minCharge, setMinCharge] = useState(String(DEFAULT_MIN_CHARGE));
  const [status, setStatus] = useState<LoadStatus>("quoted");

  const addLoad = useAddLoad();

  // Distance recalculates automatically as ZIPs are entered.
  const distance = useMemo(
    () => estimateMiles(originZip, destZip),
    [originZip, destZip],
  );

  // Quote recalculates from miles + pricing inputs.
  const quote = useMemo(() => {
    if (!distance) return null;
    return estimateQuote(distance.roadMiles, {
      ratePerMile: Number(ratePerMile) || 0,
      fuelPct: (Number(fuelPct) || 0) / 100,
      minCharge: Number(minCharge) || 0,
    });
  }, [distance, ratePerMile, fuelPct, minCharge]);

  const bothZipsEntered = originZip.trim().length >= 3 && destZip.trim().length >= 3;
  const zipError = bothZipsEntered && !distance;
  const canSubmit = ref.trim().length > 0 && !!distance && !addLoad.isPending;

  const label = (zip: string) => {
    const d = estimateMiles(zip, zip);
    return d ? `${d.origin.city}, ${d.origin.state} (${zip.trim()})` : zip.trim();
  };

  const handleSubmit = () => {
    if (!distance) return;
    addLoad.mutate(
      {
        ref: ref.trim(),
        originLabel: label(originZip),
        destinationLabel: label(destZip),
        miles: distance.roadMiles,
        rateUsd: quote ? quote.quote : null,
        status,
      },
      { onSuccess: onClose },
    );
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold">Add load</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Reference *</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. LOAD-1042" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Origin ZIP</label>
              <input
                value={originZip}
                onChange={(e) => setOriginZip(e.target.value)}
                inputMode="numeric"
                placeholder="30301"
                className={inputCls}
              />
              {distance && <p className="mt-1 text-xs text-slate-500">{distance.origin.city}, {distance.origin.state}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Destination ZIP</label>
              <input
                value={destZip}
                onChange={(e) => setDestZip(e.target.value)}
                inputMode="numeric"
                placeholder="07001"
                className={inputCls}
              />
              {distance && <p className="mt-1 text-xs text-slate-500">{distance.destination.city}, {distance.destination.state}</p>}
            </div>
          </div>

          {/* Auto-calculated distance */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            {distance ? (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Estimated distance</span>
                <span className="text-sm text-slate-700">
                  <strong className="text-lg text-slate-900">{distance.roadMiles.toLocaleString()}</strong> road mi
                  <span className="text-slate-400"> · {distance.straightMiles.toLocaleString()} straight (×{DEFAULT_ROAD_FACTOR})</span>
                </span>
              </div>
            ) : (
              <span className="text-sm text-slate-400">
                {zipError ? "One of these ZIP zones isn't recognized (PO-box-only or military ZIPs aren't covered)." : "Enter both ZIP codes to auto-calculate miles."}
              </span>
            )}
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Rate / mile</label>
              <input value={ratePerMile} onChange={(e) => setRatePerMile(e.target.value)} inputMode="decimal" placeholder="2.50" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Fuel %</label>
              <input value={fuelPct} onChange={(e) => setFuelPct(e.target.value)} inputMode="decimal" placeholder="18" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Minimum $</label>
              <input value={minCharge} onChange={(e) => setMinCharge(e.target.value)} inputMode="decimal" placeholder="350" className={inputCls} />
            </div>
          </div>

          {/* Auto-calculated quote */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            {quote ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Line haul</span><span>{usd(quote.lineHaul)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Fuel surcharge</span><span>{usd(quote.fuel)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-emerald-200 pt-1">
                  <span className="text-sm font-medium text-slate-600">Quote</span>
                  <span className="text-lg font-bold text-emerald-700">{usd(quote.quote)}</span>
                </div>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Quote appears once both ZIP codes are recognized.</span>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as LoadStatus)} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {addLoad.isError && (
            <p className="text-sm text-red-600">
              {addLoad.error instanceof Error ? addLoad.error.message : "Failed to save load."}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addLoad.isPending ? "Saving…" : "Save load"}
          </button>
        </div>
      </div>
    </div>
  );
}
