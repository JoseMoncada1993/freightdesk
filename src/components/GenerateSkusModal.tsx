// Generate SKUs for one or more selected shipments. Picking a supplier
// auto-fills Location / Program / Prefix from the SKU conventions; each
// shipment's load # defaults to its reference and stays editable. Generated
// SKUs are saved to the SKU Generator dashboard (skus table) linked to the
// shipment, so they show on the Shipments table and export with the rest.
import { useMemo, useState } from "react";
import Modal, { Field, ModalActions, inputCls, ErrorText } from "@/components/ui/Modal";
import { useAddSkus, useSkus, useSkuConventions } from "@/hooks/useSkus";
import { buildPrefix, cleanLoad } from "@/lib/skuTemplate";
import type { LoadEnriched, SkuConvention } from "@/lib/types";

export default function GenerateSkusModal({
  loads,
  onClose,
}: {
  loads: LoadEnriched[];
  onClose: () => void;
}) {
  const { data: conventions } = useSkuConventions();
  const { data: skus } = useSkus();
  const addSkus = useAddSkus();

  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [program, setProgram] = useState("");
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);
  const [loadNums, setLoadNums] = useState<Record<number, string>>(() =>
    Object.fromEntries(loads.map((l) => [l.id ?? -1, l.ref ?? ""])),
  );

  const convList = useMemo(() => conventions ?? [], [conventions]);
  const autoPrefix = buildPrefix(supplier, location, program);
  const prefix = prefixOverride ?? autoPrefix;

  const applyConvention = (c: Pick<SkuConvention, "location" | "program" | "prefix">) => {
    setLocation(c.location ?? "");
    setProgram(c.program ?? "");
    setPrefixOverride(c.prefix);
  };

  const onSupplierChange = (val: string) => {
    setSupplier(val);
    const match = convList.find((c) => c.supplier.toLowerCase() === val.trim().toLowerCase());
    if (match) applyConvention(match);
  };

  const matched = convList.find((c) => c.supplier.toLowerCase() === supplier.trim().toLowerCase());

  const existing = useMemo(() => new Set((skus ?? []).map((s) => s.sku)), [skus]);

  const rows = loads
    .filter((l) => l.id != null)
    .map((l) => {
      const num = loadNums[l.id!] ?? "";
      const sku = prefix + cleanLoad(num);
      return { load: l, num, sku, ok: prefix !== "" && cleanLoad(num) !== "" };
    });

  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.sku, (seen.get(r.sku) ?? 0) + 1);
  const problems = rows.map((r) =>
    !r.ok ? "missing" : existing.has(r.sku) ? "exists" : (seen.get(r.sku) ?? 0) > 1 ? "batch-dup" : null,
  );

  const canSubmit = rows.length > 0 && problems.every((p) => p === null) && !addSkus.isPending;

  const submit = () => {
    if (!canSubmit) return;
    addSkus.mutate(
      rows.map((r) => ({
        sku: r.sku,
        prefix,
        supplier: supplier.trim() || null,
        location: location.trim() || null,
        program: program.trim() || null,
        load_ref: r.num.trim() || r.load.ref || null,
        load_id: r.load.id,
      })),
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      title={`Generate SKUs for ${loads.length} shipment${loads.length === 1 ? "" : "s"}`}
      onClose={onClose}
      wide
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={addSkus.isPending ? "Generating…" : `Generate ${rows.length} SKU${rows.length === 1 ? "" : "s"}`}
          pending={addSkus.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Supplier">
          <input
            value={supplier}
            onChange={(e) => onSupplierChange(e.target.value)}
            list="gen-sku-suppliers"
            placeholder="Start typing a supplier…"
            className={inputCls}
          />
          <datalist id="gen-sku-suppliers">
            {convList.map((c) => (
              <option key={c.id} value={c.supplier} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-400">
            {matched ? `Convention: ${matched.prefix}` : "Auto-fills location, program & prefix"}
          </p>
        </Field>
        <Field label="Prefix (editable)">
          <input
            value={prefix}
            onChange={(e) => setPrefixOverride(e.target.value.toUpperCase())}
            placeholder="Auto from supplier"
            className={inputCls}
          />
        </Field>
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Perris,CA" className={inputCls} />
        </Field>
        <Field label="Program">
          <input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Salvage" className={inputCls} />
        </Field>
      </div>

      <div className="rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Shipment</th>
              <th className="px-3 py-2 font-medium">Load # (editable)</th>
              <th className="px-3 py-2 font-medium">Generated SKU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.load.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{r.load.ref ?? `#${r.load.id}`}</td>
                <td className="px-3 py-2">
                  <input
                    value={r.num}
                    onChange={(e) => setLoadNums((prev) => ({ ...prev, [r.load.id!]: e.target.value }))}
                    className={inputCls}
                  />
                </td>
                <td className="px-3 py-2 font-mono">
                  {r.sku || "—"}
                  {problems[i] === "exists" && <span className="ml-2 text-xs text-red-600">already exists</span>}
                  {problems[i] === "batch-dup" && <span className="ml-2 text-xs text-red-600">duplicate in batch</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorText error={addSkus.error} />
    </Modal>
  );
}
