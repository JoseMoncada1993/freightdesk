// Sam's Club vendor inventory tracker. Mirrors the vendor's "Pallet Id tracker"
// spreadsheet: filter (slice) by Status and Club, search many pallet IDs at
// once, bulk-update status, and import SKU + pallet id + club from CSV.
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import ImportCsvModal from "@/components/ImportCsvModal";
import Modal, { Field, ModalActions, inputCls } from "@/components/ui/Modal";
import { useAuth } from "@/lib/AuthContext";
import {
  useSamsPallets,
  useUpdateSamsStatus,
  useUpdateSamsPallet,
  useUpsertSamsPallets,
} from "@/hooks/useSamsPallets";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import { SAMS_STATUSES } from "@/lib/types";
import type { SamsPallet } from "@/lib/types";

const RENDER_CAP = 1000;
const BLANK = "__blank__";

const STATUS_STYLES: Record<string, string> = {
  Delivered: "bg-emerald-100 text-emerald-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Pending: "bg-amber-100 text-amber-700",
  "Need to Schedule": "bg-red-100 text-red-700",
};

const fmtDate = (v: string | null) => {
  if (!v) return "—";
  const d = new Date(v + (v.length <= 10 ? "T00:00:00" : ""));
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
};

// Accept common date strings from Excel/Sheets → ISO date (YYYY-MM-DD) or null.
const parseDate = (v: string): string | null => {
  if (!v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function StatusPill({ status }: { status: string | null }) {
  const cls = (status && STATUS_STYLES[status]) || "bg-slate-100 text-slate-500";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status || "—"}</span>;
}

function InlineStatus({ pallet, disabled }: { pallet: SamsPallet; disabled: boolean }) {
  const update = useUpdateSamsPallet();
  return (
    <select
      value={pallet.status ?? ""}
      disabled={disabled || update.isPending}
      onChange={(e) => update.mutate({ id: pallet.id, status: e.target.value || null })}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">—</option>
      {SAMS_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

interface AddModalProps {
  onClose: () => void;
}
function AddPalletModal({ onClose }: AddModalProps) {
  const upsert = useUpsertSamsPallets();
  const [palletId, setPalletId] = useState("");
  const [sku, setSku] = useState("");
  const [club, setClub] = useState("");
  const [status, setStatus] = useState<string>("Need to Schedule");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const submit = () => {
    if (!palletId.trim()) return;
    upsert.mutate(
      [{
        pallet_id: palletId.trim(),
        sku: sku.trim() || null,
        club: club.trim().toUpperCase() || null,
        status: status || null,
        notes: notes.trim() || null,
        delivery_date: deliveryDate || null,
      }],
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      title="Add pallet (no manifest)"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Add pallet"
          pending={upsert.isPending}
          disabled={!palletId.trim() || upsert.isPending}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pallet ID *">
          <input value={palletId} onChange={(e) => setPalletId(e.target.value)} className={inputCls} />
        </Field>
        <Field label="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Club">
          <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="CONCORD" className={inputCls} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {SAMS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Delivery date">
          <input value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} type="date" className={inputCls} />
        </Field>
        <Field label="Notes / Tracking #">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </Modal>
  );
}

export default function SamsClub() {
  const { can } = useAuth();
  const canWrite = can("sams");
  const { data, isLoading, error } = useSamsPallets();
  const bulkUpdate = useUpdateSamsStatus();
  const importUpsert = useUpsertSamsPallets();

  const [statusFilter, setStatusFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [palletSearch, setPalletSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("Scheduled");
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  const clubs = useMemo(
    () => Array.from(new Set(rows.map((r) => r.club).filter(Boolean))).sort() as string[],
    [rows],
  );

  // Multi-ID search: split on whitespace / comma / semicolon; match pallet_id or SKU.
  const searchSet = useMemo(() => {
    const parts = palletSearch.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    return new Set(parts.map((s) => s.toUpperCase()));
  }, [palletSearch]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === BLANK ? r.status != null && r.status !== "" : statusFilter && r.status !== statusFilter) return false;
      if (clubFilter && r.club !== clubFilter) return false;
      if (searchSet.size > 0) {
        const pid = (r.pallet_id ?? "").toUpperCase();
        const sku = (r.sku ?? "").toUpperCase();
        if (!searchSet.has(pid) && !searchSet.has(sku)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, clubFilter, searchSet]);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.status ?? "—", (m.get(r.status ?? "—") ?? 0) + 1);
    return m;
  }, [filtered]);

  const visible = filtered.slice(0, RENDER_CAP);
  const capped = filtered.length > RENDER_CAP;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(() => (allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id))));

  const applyBulk = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulkUpdate.mutate(
      { ids, status: bulkStatus || null },
      { onSuccess: () => setSelected(new Set()) },
    );
  };

  const doExport = () =>
    exportCsv(
      filtered.map((r) => ({
        sku: r.sku, pallet_id: r.pallet_id, club: r.club, status: r.status,
        delivery_date: r.delivery_date, notes: r.notes,
      })),
      "sams_club_pallets",
    );

  return (
    <div>
      <PageHeader
        title="Sam's Club"
        subtitle="Track Sam's Club pallet inventory by club and status. Filter with the slicers, paste multiple pallet IDs to search, then bulk-update status."
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={doExport} {...exportButtonProps(filtered.length)}>Export CSV</button>
            {canWrite && (
              <>
                <button
                  onClick={() => setShowImport(true)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Import CSV
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + Add pallet
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Slicers + multi-ID search */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="">All statuses</option>
            {SAMS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value={BLANK}>(no status)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Club</label>
          <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)} className={inputCls}>
            <option value="">All clubs ({clubs.length})</option>
            {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Search pallet IDs / SKUs (paste many — comma, space or newline separated)
          </label>
          <div className="flex gap-2">
            <input
              value={palletSearch}
              onChange={(e) => setPalletSearch(e.target.value)}
              placeholder="64720626120703, 64720626120112 …"
              className={inputCls}
            />
            {palletSearch && (
              <button
                onClick={() => setPalletSearch("")}
                className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-800 px-2.5 py-1 font-medium text-white">
          {filtered.length.toLocaleString()} pallet{filtered.length === 1 ? "" : "s"}
        </span>
        {[...statusCounts.entries()].sort((a, b) => b[1] - a[1]).map(([st, n]) => (
          <span key={st} className={`rounded-full px-2.5 py-1 font-medium ${STATUS_STYLES[st] ?? "bg-slate-100 text-slate-500"}`}>
            {st}: {n.toLocaleString()}
          </span>
        ))}
        {searchSet.size > 0 && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
            searching {searchSet.size} ID{searchSet.size === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {canWrite && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-900">{selected.size} selected</span>
          <span className="text-sm text-slate-600">Set status to</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            {SAMS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="">(clear status)</option>
          </select>
          <button
            onClick={applyBulk}
            disabled={bulkUpdate.isPending}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkUpdate.isPending ? "Updating…" : "Update status"}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm font-medium text-slate-500 hover:underline">
            Clear selection
          </button>
        </div>
      )}

      {capped && (
        <p className="mb-2 text-xs text-amber-600">
          Showing the first {RENDER_CAP.toLocaleString()} of {filtered.length.toLocaleString()} — narrow the filters or search to see the rest.
        </p>
      )}

      <DataTable<SamsPallet>
        rows={visible}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="No pallets match these filters. Import a CSV to get started."
        columns={[
          {
            header: canWrite ? "" : " ",
            cell: (r) =>
              canWrite ? (
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="rounded border-slate-300" />
              ) : null,
          },
          { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku ?? "—"}</span>, sort: (r) => r.sku },
          { header: "Pallet ID", cell: (r) => <span className="font-mono">{r.pallet_id}</span>, sort: (r) => r.pallet_id },
          { header: "Club", cell: (r) => r.club ?? "—", sort: (r) => r.club },
          {
            header: "Status",
            cell: (r) => (canWrite ? <InlineStatus pallet={r} disabled={false} /> : <StatusPill status={r.status} />),
            sort: (r) => r.status,
          },
          { header: "Delivery", cell: (r) => fmtDate(r.delivery_date), sort: (r) => r.delivery_date },
          { header: "Notes / Tracking #", cell: (r) => r.notes ?? "—", sort: (r) => r.notes },
        ]}
      />

      {canWrite && visible.length > 0 && (
        <button onClick={toggleAll} className="mt-3 text-xs font-medium text-blue-600 hover:underline">
          {allVisibleSelected ? "Clear selection" : `Select all ${visible.length} shown`}
        </button>
      )}

      {showAdd && <AddPalletModal onClose={() => setShowAdd(false)} />}

      {showImport && (
        <ImportCsvModal
          title="Import Sam's Club pallets"
          fields={[
            { key: "pallet_id", aliases: ["pallet id", "pallet_id", "pallet"], required: true },
            { key: "sku", aliases: ["sku"] },
            { key: "club", aliases: ["club", "store"] },
            { key: "status", aliases: ["status"] },
            { key: "delivery_date", aliases: ["delivery date", "delivery_date"] },
            { key: "notes", aliases: ["notes/tracking #", "notes", "tracking #", "tracking", "notes/tracking"] },
          ]}
          exampleHeader="SKU, Pallet ID, Status, Delivery Date, Notes/Tracking #, Club"
          toPayload={(r) => ({
            pallet_id: r.pallet_id,
            sku: r.sku || null,
            club: r.club ? r.club.toUpperCase() : null,
            status: r.status || null,
            delivery_date: parseDate(r.delivery_date),
            notes: r.notes || null,
          })}
          onImport={async (payloads) => {
            // Re-importing updates existing pallets (upsert on pallet_id).
            await importUpsert.mutateAsync(payloads as never);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
