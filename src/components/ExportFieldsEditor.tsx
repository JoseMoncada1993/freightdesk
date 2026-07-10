// Editable grid for the product-template ("blue header") export columns.
// Used to set a convention's default export fields and to override them on an
// individual SKU. `placeholders` shows the inherited default for each field.
import { useState } from "react";
import { inputCls } from "@/components/ui/Modal";
import { EDITABLE_TEMPLATE_HEADERS } from "@/lib/skuTemplate";

export default function ExportFieldsEditor({
  values,
  onChange,
  placeholders,
}: {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  placeholders?: Record<string, string>;
}) {
  const [filter, setFilter] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);

  const q = filter.trim().toLowerCase();
  const headers = EDITABLE_TEMPLATE_HEADERS.filter((h) => {
    if (q && !h.toLowerCase().includes(q)) return false;
    if (onlyFilled && !(values[h] ?? "").trim() && !(placeholders?.[h] ?? "").trim()) return false;
    return true;
  });

  const filled = EDITABLE_TEMPLATE_HEADERS.filter((h) => (values[h] ?? "").trim() !== "").length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter fields…"
          className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={onlyFilled}
            onChange={(e) => setOnlyFilled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Only fields with values
        </label>
        <span className="text-xs text-slate-400">{filled} of {EDITABLE_TEMPLATE_HEADERS.length} set</span>
      </div>
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
          {headers.map((h) => (
            <div key={h}>
              <label className="mb-0.5 block truncate text-[11px] font-medium text-slate-500" title={h}>
                {h}
              </label>
              <input
                value={values[h] ?? ""}
                onChange={(e) => onChange({ ...values, [h]: e.target.value })}
                placeholder={placeholders?.[h] ?? ""}
                className={inputCls}
              />
            </div>
          ))}
          {headers.length === 0 && (
            <p className="col-span-full py-4 text-center text-xs text-slate-400">No fields match.</p>
          )}
        </div>
      </div>
    </div>
  );
}
