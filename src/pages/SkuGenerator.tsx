// SKU Generator. Builds a SKU from a supplier/location/program prefix + load #,
// optionally linked to a shipment. Picking a supplier from the convention
// reference (sku_conventions) auto-fills Location, Program and Prefix; the SKU is
// Prefix + Load# (no separator). Generated SKUs can be archived, searched by load
// # / supplier, and exported in the platform "product template" format (CSV/Excel).
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
  useUpdateSku,
  useSkuConventions,
  useAddSkuConvention,
  useUpdateSkuConvention,
  useDeleteSkuConvention,
} from "@/hooks/useSkus";
import { exportCsv } from "@/lib/csv";
import { downloadXlsx } from "@/lib/xlsx";
import { buildProductTemplateRows } from "@/lib/skuTemplate";
import type { Sku, SkuConvention } from "@/lib/types";

const code = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3);
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

// ---- Add / edit a supplier convention -------------------------------------
function ConventionFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: SkuConvention | null;
  onClose: () => void;
  onSaved?: (c: { supplier: string; location: string; program: string; prefix: string }) => void;
}) {
  const add = useAddSkuConvention();
  const update = useUpdateSkuConvention();
  const [supplier, setSupplier] = useState(existing?.supplier ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [program, setProgram] = useState(existing?.program ?? "");
  const [prefix, setPrefix] = useState(existing?.prefix ?? "");
  const pending = add.isPending || update.isPending;
  const canSave = supplier.trim() !== "" && prefix.trim() !== "" && !pending;

  const submit = () => {
    if (!canSave) return;
    const payload = {
      supplier: supplier.trim(),
      location: location.trim() || null,
      program: program.trim() || null,
      prefix: prefix.trim().toUpperCase(),
    };
    const done = () => {
      onSaved?.({ supplier: payload.supplier, location: payload.location ?? "", program: payload.program ?? "", prefix: payload.prefix });
      onClose();
    };
    if (existing) update.mutate({ id: existing.id, ...payload }, { onSuccess: done });
    else add.mutate(payload, { onSuccess: done });
  };

  return (
    <Modal
      title={existing ? "Edit SKU convention" : "Add supplier & SKU convention"}
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} onSubmit={submit} submitLabel="Save convention" pending={pending} disabled={!canSave} />}
    >
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
      <ErrorText error={add.error || update.error} />
    </Modal>
  );
}

// ---- Manage conventions (list + edit + delete) ----------------------------
function ConventionsManagerModal({ onClose }: { onClose: () => void }) {
  const { data: conventions } = useSkuConventions();
  const del = useDeleteSkuConvention();
  const [editing, setEditing] = useState<SkuConvention | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");

  const rows = (conventions ?? []).filter((c) =>
    filter.trim() === "" ? true : `${c.supplier} ${c.prefix} ${c.location ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Modal title="Manage SKU conventions" onClose={onClose} wide
      footer={<button onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>}
    >
      <div className="flex items-center justify-between gap-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter suppliers…" className={inputCls} />
        <button onClick={() => setAdding(true)} className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Add
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Program</th>
              <th className="px-3 py-2 font-medium">Prefix</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{c.supplier}</td>
                <td className="px-3 py-2">{c.location ?? "—"}</td>
                <td className="px-3 py-2">{c.program ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{c.prefix}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditing(c)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                    <button
                      onClick={() => { if (confirm(`Delete convention "${c.supplier}"?`)) del.mutate(c.id); }}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No conventions match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && <ConventionFormModal existing={null} onClose={() => setAdding(false)} />}
      {editing && <ConventionFormModal existing={editing} onClose={() => setEditing(null)} />}
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
  const updateSku = useUpdateSku();

  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [program, setProgram] = useState("");
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);
  const [loadRef, setLoadRef] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const convList = useMemo(() => conventions ?? [], [conventions]);

  const autoPrefix = buildPrefix(supplier, location, program);
  const prefix = prefixOverride ?? autoPrefix;
  const loadPart = cleanLoad(loadRef);
  const sku = prefix + loadPart; // Prefix & Load# only — no separator.

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

  const matchedConvention = convList.find((c) => c.supplier.toLowerCase() === supplier.trim().toLowerCase());

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
    const match = (loads.data ?? []).find((l) => (l.ref ?? "").toUpperCase() === loadPart);
    addSku.mutate(
      {
        sku, prefix,
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

  // Search by load # / supplier (+ sku), and active/archived filter.
  const visibleSkus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (skus ?? []).filter((s) => {
      if (showArchived ? !s.archived : s.archived) return false;
      if (q) {
        const hay = `${s.load_ref ?? ""} ${s.supplier ?? ""} ${s.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [skus, search, showArchived]);

  // Export the visible SKUs in the platform product-template ("blue header") format.
  const exportRows = () => buildProductTemplateRows(visibleSkus, convList);
  const exportCsvTemplate = () => {
    const aoa = exportRows();
    const [hdr, ...body] = aoa;
    const objs = body.map((r) => Object.fromEntries(hdr.map((h, i) => [String(h), r[i]])));
    exportCsv(objs, "sku_products", hdr.map((h) => ({ key: String(h) })));
  };
  const exportXlsxTemplate = () => downloadXlsx(exportRows(), "sku_products", "Products");

  const refById = new Map((loads.data ?? []).map((l) => [l.id, l.ref]));

  return (
    <div>
      <PageHeader
        title="SKU Generator"
        subtitle="Pick a supplier to auto-fill its location, program and prefix, add a load #, then generate. SKU = Prefix + Load#."
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={exportCsvTemplate} disabled={visibleSkus.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Export CSV
            </button>
            <button onClick={exportXlsxTemplate} disabled={visibleSkus.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Export Excel
            </button>
            {canWrite && (
              <button onClick={() => setShowManage(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Manage conventions
              </button>
            )}
          </div>
        }
      />

      {canWrite && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Supplier">
              <div className="flex gap-2">
                <input value={supplier} onChange={(e) => onSupplierChange(e.target.value)} list="sku-suppliers" placeholder="Start typing a supplier…" className={inputCls} />
                <button type="button" onClick={() => setShowAddSupplier(true)} title="Add a new supplier & convention"
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
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
              <input value={prefix} onChange={(e) => setPrefixOverride(e.target.value.toUpperCase())} placeholder="Auto from supplier / fields" className={inputCls} />
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
            <button onClick={handleGenerate} disabled={!canSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
              {addSku.isPending ? "Saving…" : "Generate & Save"}
            </button>
          </div>
          <div className="mt-2"><ErrorText error={addSku.error} /></div>
        </div>
      )}

      {/* Search + archive toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by load # or supplier…"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-slate-300" />
          Archived
        </label>
        <span className="text-xs text-slate-400">{visibleSkus.length} SKU{visibleSkus.length === 1 ? "" : "s"}</span>
      </div>

      <DataTable<Sku>
        rows={visibleSkus}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty={showArchived ? "No archived SKUs." : "No SKUs generated yet."}
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
                <div className="flex justify-end gap-3 whitespace-nowrap">
                  <button
                    onClick={() => updateSku.mutate({ id: r.id, archived: !r.archived })}
                    className="text-slate-500 hover:underline text-xs font-medium"
                  >
                    {r.archived ? "Restore" : "Archive"}
                  </button>
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
        <ConventionFormModal
          existing={null}
          onClose={() => setShowAddSupplier(false)}
          onSaved={(c) => { setSupplier(c.supplier); applyConvention(c); }}
        />
      )}
      {showManage && <ConventionsManagerModal onClose={() => setShowManage(false)} />}
    </div>
  );
}
