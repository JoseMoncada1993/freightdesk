import { useEffect, useRef } from "react";

// U.S. Diesel Price widget (oilpriceapi.com).
// Loads the third-party widget script once and renders it into the
// placeholder div. No API key required; the script only calls
// oilpriceapi.com for DOE/EIA weekly diesel prices.
export default function DieselWidget() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SRC = "https://www.oilpriceapi.com/widgets/diesel.js";

    const existing = document.querySelector(
      `script[src="${SRC}"]`
    ) as HTMLScriptElement | null;

    if (!existing) {
      const script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h2 className="font-semibold mb-4">U.S. Diesel Prices</h2>
      <div
        ref={ref}
        id="oilpriceapi-diesel"
        data-theme="light"
        data-regional="true"
      />
      <p className="text-slate-400 text-xs mt-3">
        Source: DOE/EIA weekly averages via oilpriceapi.com
      </p>
    </div>
  );
}
