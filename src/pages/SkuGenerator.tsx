// SKU Generator. Builds a SKU from a supplier/location/program prefix + load #,
// optionally linked to a shipment. prefix = f(supplier, location, program);
// SKU = prefix + "-" + load #. The prefix is editable so any convention works.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Field, inputCls, ErrorText } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import { useLoads } from "@/hooks/useLoads";
import { useSkus, useAddSku, useDeleteSku } from "@/hooks/useSkus";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { Sku } from "@/lib/types";

// Short code from a free-text field: uppercase alphanumerics, first 3 chars.
const code = (v: string) =>
  v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3);

const buildPrefix = (supplier: string, location: string, program: string) =>
  [supplier, location, program].map(code).filter(Boolean).join("-");

const cleanLoad = (v: string) => v.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const uniq = (xs: (string | null | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is string => !!x && x.trim() !== ""))).sort();

export default function SkuGenerator() {
  const { can } = useAuth();
  const canWrite = can("skus");
  const loads = useLoads();
  const { data: skus, isLoading, error } = useSkus();
  const addSku = useAddSku();
  const del = useDeleteSku();

  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [program, setProgram] = useState("");
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);
  const [loadRef, setLoadRef] = useState("");
  const [notes, setNotes] = useState("");

  const autoPrefix = buildPrefix(supplier, location, program);
  const prefix = prefixOverride ?? autoPrefix;
  const loadPart = cleanLoad(loadRef);
  const sku = [prefix, loadPart].filter(Boolean).join("-");

  // Reuse prior values for quick entry.
  const suppliers = useMemo(() => uniq((skus ?? []).map((s) => s.supplier)), [skus]);
  const locations = useMemo(() => uniq((skus ?? []).map((s) => s.location)), [skus]);
  const programs = useMemo(() => uniq((skus ?? []).map((s) => s.program)), [skus]);

  const existing = new Set((skus ?? []).map((s) => s.sku));
  const duplicate = sku !== "" && existing.has(sku);
  const canSubmit = canWrite && prefix !== "" && loadPart !== "" && !duplicate && !addSku.isPending;

  const reset = () => {
    setLoadRef("");
    setNotes("");
    setPrefixOverride(null);
  };

  const handleGenerate = () => {
    if (!canSubmit) return;
    // Link to a shipment when the load # matches an existing shipment ref.
    const match = (loads.data ?? []).find(
      (l) => (l.ref ?? "").toUpperCase() === loadPart,
    );
    addSku.mutate(
      {
        sku,
        prefix,
        supplier: supplier.trim() || null,
        location: location.trim() || null,
        program: program.trim() || null,
        load_ref: loadRef.trim() || null,
        load_id: match?.id ?? null,
        notes: notes.trim() || null,
      },
      { onSuccess: reset },
    );
  };

  const doExport = () =>
    exportCsv(
      (skus ?? []).map((s) => ({
        sku: s.sku, prefix: s.prefix, supplier: s.supplier, location: s.location,
        program: s.program, load_ref: s.load_ref, created_at: s.created_at,
      })),
      "skus",
    );

  const refById = new Map((loads.data ?? []).map((l) => [l.id, l.ref]));

  return (
    <div>
      <PageHeader
        title="SKU Generator"
        subtitle="Build a SKU from a supplier / location / program prefix and a load #. Linked to a shipment when the load # matches."
        action={<button onClick={doExport} {...exportButtonProps((skus ?? []).length)}>Export CSV</button>}
      />

      {canWrite && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Supplier">
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="sku-suppliers" placeholder="Acme Foods" className={inputCls} />
              <datalist id="sku-suppliers">{suppliers.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="Location">
              <input value={location} onChange={(e) => setLocation(e.target.value)} list="sku-locations" placeholder="Dallas, TX" className={inputCls} />
              <datalist id="sku-locations">{locations.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="Program">
              <input value={program} onChange={(e) => setProgram(e.target.value)} list="sku-programs" placeholder="Retail" className={inputCls} />
              <datalist id="sku-programs">{programs.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Prefix (editable)">
              <input
                value={prefix}
                onChange={(e) => setPrefixOverride(e.target.value.toUpperCase())}
                placeholder="Auto from fields above"
                className={inputCls}
              />
            </Field>
            <Field label="Load #">
              <input value={loadRef} onChange={(e) => setLoadRef(e.target.value)} list="sku-loads" placeholder="LD-2105" className={inputCls} />
              <datalist id="sku-loads">
                {(loads.data ?? []).map((l) => (l.ref ? <option key={l.id} value={l.ref} /> : null))}
              </datalist>
            </Field>
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="text-sm">
              <span className="text-slate-500">Generated SKU: </span>
              <span className="font-mono font-semibold text-slate-800">{sku || "—"}</span>
              {duplicate && <span className="ml-3 text-red-600">Already exists</span>}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {addSku.isPending ? "Saving…" : "Generate & Save"}
            </button>
          </div>
          <div className="mt-2"><ErrorText error={addSku.error} /></div>
        </div>
      )}

      <DataTable<Sku>
        rows={skus ?? []}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="No SKUs generated yet."
        columns={[
          { header: "SKU", cell: (r) => <span className="font-mono font-medium">{r.sku}</span>, sort: (r) => r.sku },
          { header: "Prefix", cell: (r) => <span className="font-mono">{r.prefix}</span>, sort: (r) => r.prefix },
          { header: "Supplier", cell: (r) => r.supplier ?? "—", sort: (r) => r.supplier },
          { header: "Location", cell: (r) => r.location ?? "—", sort: (r) => r.location },
          { header: "Program", cell: (r) => r.program ?? "—", sort: (r) => r.program },
          {
            header: "Shipment",
            cell: (r) => (r.load_id != null ? (refById.get(r.load_id) ?? r.load_ref ?? "—") : (r.load_ref ?? "—")),
            sort: (r) => r.load_ref,
          },
          { header: "Created", cell: (r) => fmtDate(r.created_at), sort: (r) => r.created_at },
          {
            header: "",
            cell: (r) =>
              canWrite ? (
                <div className="flex justify-end">
                  <button
                    onClick={() => { if (confirm(`Delete SKU ${r.sku}?`)) del.mutate(r.id); }}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
