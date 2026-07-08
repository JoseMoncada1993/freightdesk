// SKU Generator. Builds a SKU from a supplier/location/program prefix + load #,
// optionally linked to a shipment. Picking a supplier from the convention
// reference (sku_conventions) auto-fills Location, Program and Prefix; SKU =
// prefix + "-" + load #. All fields stay editable, and new supplier conventions
// can be added inline.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Modal, { Field, ModalActions, inputCls, ErrorText } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import { useLoads } from "@/hooks/useLoads";
import {
  useSkus,
  useAddSku,
  useDeleteSku,
  useSkuConventions,
  useAddSkuConvention,
} from "@/hooks/useSkus";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { Sku, SkuConvention } from "@/lib/types";

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

function AddSupplierModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (c: { supplier: string; location: string; program: string; prefix: string }) => void;
}) {
  const add = useAddSkuConvention();
  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [program, setProgram] = useState("");
  const [prefix, setPrefix] = useState("");

  const canSave = supplier.trim() !== "" && prefix.trim() !== "" && !add.isPending;

  const submit = () => {
    if (!canSave) return;
    const payload = {
      supplier: supplier.trim(),
      location: location.trim() || null,
      program: program.trim() || null,
      prefix: prefix.trim().toUpperCase(),
    };
    add.mutate(payload, {
      onSuccess: () => {
        onAdded({
          supplier: payload.supplier,
          location: payload.location ?? "",
          program: payload.program ?? "",
          prefix: payload.prefix,
        });
        onClose();
      },
    });
  };

  return (
    <Modal
      title="Add supplier & SKU convention"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Save convention"
          pending={add.isPending}
          disabled={!canSave}
        />
      }
    >
      <p className="text-sm text-slate-500">
        Saved to the convention reference. Next time you pick this supplier, its location,
        program and prefix fill in automatically.
      </p>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Supplier *">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="WayFair Perris Salvage" className={inputCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Perris,CA" className={inputCls} />
          </Field>
          <Field label="Program">
            <input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Salvage" className={inputCls} />
          </Field>
          <Field label="Prefix (SKU convention) *">
            <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="WYFPRS" className={inputCls} />
          </Field>
        </div>
      </div>
      <ErrorText error={add.error} />
    </Modal>
  );
}

export default function SkuGenerator() {
  const { can } = useAuth();
  const canWrite = can("skus");
  const loads = useLoads();
  const { data: skus, isLoading, error } = useSkus();
  const { data: conventions } = useSkuConventions();
  const addSku = useAddSku();
  const del = useDeleteSku();

  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [program, setProgram] = useState("");
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);
  const [loadRef, setLoadRef] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const convList = useMemo(() => conventions ?? [], [conventions]);

  const autoPrefix = buildPrefix(supplier, location, program);
  const prefix = prefixOverride ?? autoPrefix;
  const loadPart = cleanLoad(loadRef);
  const sku = [prefix, loadPart].filter(Boolean).join("-");

  // Apply a supplier convention's location/program/prefix to the form.
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

  const matchedConvention = convList.find(
    (c) => c.supplier.toLowerCase() === supplier.trim().toLowerCase(),
  );

  // Datalist suggestions: convention values first, then anything used before.
  const suppliers = useMemo(
    () => uniq([...convList.map((c) => c.supplier), ...(skus ?? []).map((s) => s.supplier)]),
    [convList, skus],
  );
  const locations = useMemo(
    () => uniq([...convList.map((c) => c.location), ...(skus ?? []).map((s) => s.location)]),
    [convList, skus],
  );
  const programs = useMemo(
    () => uniq([...convList.map((c) => c.program), ...(skus ?? []).map((s) => s.program)]),
    [convList, skus],
  );

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
        subtitle="Pick a supplier to auto-fill its location, program and prefix, add a load #, then generate. Linked to a shipment when the load # matches."
        action={<button onClick={doExport} {...exportButtonProps((skus ?? []).length)}>Export CSV</button>}
      />

      {canWrite && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Supplier">
              <div className="flex gap-2">
                <input
                  value={supplier}
                  onChange={(e) => onSupplierChange(e.target.value)}
                  list="sku-suppliers"
                  placeholder="Start typing a supplier…"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(true)}
                  title="Add a new supplier & convention"
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  + New
                </button>
              </div>
              <datalist id="sku-suppliers">{suppliers.map((v) => <option key={v} value={v} />)}</datalist>
              <p className="mt-1 text-xs text-slate-400">
                {matchedConvention
                  ? `Convention: ${matchedConvention.prefix}${matchedConvention.location ? ` · ${matchedConvention.location}` : ""}`
                  : `${convList.length} known suppliers — auto-fills location, program & prefix`}
              </p>
            </Field>
            <Field label="Location">
              <input value={location} onChange={(e) => setLocation(e.target.value)} list="sku-locations" placeholder="Perris,CA" className={inputCls} />
              <datalist id="sku-locations">{locations.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="Program">
              <input value={program} onChange={(e) => setProgram(e.target.value)} list="sku-programs" placeholder="Salvage" className={inputCls} />
              <datalist id="sku-programs">{programs.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Prefix (editable)">
              <input
                value={prefix}
                onChange={(e) => setPrefixOverride(e.target.value.toUpperCase())}
                placeholder="Auto from supplier / fields"
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

      {showAddSupplier && (
        <AddSupplierModal
          onClose={() => setShowAddSupplier(false)}
          onAdded={(c) => {
            setSupplier(c.supplier);
            applyConvention(c);
          }}
        />
      )}
    </div>
  );
}
