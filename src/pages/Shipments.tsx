import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import ImportCsvModal from "@/components/ImportCsvModal";
import LoadForm from "@/components/LoadForm";
import GenerateSkusModal from "@/components/GenerateSkusModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useLoads } from "@/hooks/useLoads";
import { useCarriers, useCustomers } from "@/hooks/useTables";
import { useUpdateLoad, useDeleteLoad } from "@/hooks/useMutations";
import { useSkus, useUpdateSku } from "@/hooks/useSkus";
import { downloadBols } from "@/lib/bol";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import { LOAD_STATUSES, TRANSPORT_TYPES } from "@/lib/types";
import type { LoadEnriched, Sku } from "@/lib/types";

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const miles = (n: number | null) => (n == null ? "—" : `${n.toLocaleString()} mi`);

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "numeric", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" });
};

const ageDays = (l: LoadEnriched) => {
  const start = l.created_at ?? l.pickup_at;
  if (!start) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 864e5));
};

// Statuses present in older records that predate the current workflow list.
const LEGACY_STATUSES = ["Quoted", "Shipment approved", "BOL approved", "BOL sent", "Shipment booked"];
const DONE_STATUSES = ["delivered", "cancelled"];

function StatusSelect({ load, disabled }: { load: LoadEnriched; disabled?: boolean }) {
  const update = useUpdateLoad();
  const options = load.status && LEGACY_STATUSES.includes(load.status)
    ? [load.status, ...LOAD_STATUSES]
    : LOAD_STATUSES;
  return (
    <select
      value={load.status ?? "booked"}
      disabled={disabled || update.isPending || load.id == null}
      onChange={(e) => {
        if (load.id == null) return;
        const status = e.target.value;
        const patch: { status: string; delivered_at?: string } = { status };
        if (status === "delivered" && !load.delivered_at) {
          patch.delivered_at = new Date().toISOString();
        }
        update.mutate({ id: load.id, ...patch });
      }}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map((st) => (
        <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}

const parseDate = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// Inline-editable SKU shown on a shipment row (newest first if several).
function SkuCell({ skus, editable }: { skus: Sku[]; editable: boolean }) {
  const update = useUpdateSku();
  if (skus.length === 0) return <span className="text-slate-400">—</span>;
  const [first, ...rest] = skus;
  if (!editable) {
    return (
      <span className="font-mono text-xs">
        {first.sku}
        {rest.length > 0 && <span className="ml-1 text-slate-400">+{rest.length}</span>}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <input
        key={`${first.id}:${first.sku}`}
        defaultValue={first.sku}
        onBlur={(e) => {
          const next = e.target.value.trim().toUpperCase();
          if (next && next !== first.sku) update.mutate({ id: first.id, sku: next });
          else e.target.value = first.sku;
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        disabled={update.isPending}
        className="w-36 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Edit SKU — saves on blur"
      />
      {rest.length > 0 && <span className="text-xs text-slate-400" title={rest.map((s) => s.sku).join(", ")}>+{rest.length}</span>}
    </span>
  );
}

export default function Shipments() {
  const { data, isLoading, error } = useLoads();
  const update = useUpdateLoad();
  const del = useDeleteLoad();
  const customers = useCustomers();
  const carriers = useCarriers();
  const { can, canDelete } = useAuth();
  const canWrite = can("shipments");
  const canSku = can("skus");
  const skus = useSkus();
  const qc = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<LoadEnriched | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [userFilter, setUserFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [skuTargets, setSkuTargets] = useState<LoadEnriched[] | null>(null);

  // SKUs grouped by shipment (newest first — useSkus orders by created_at desc).
  const skusByLoad = useMemo(() => {
    const m = new Map<number, Sku[]>();
    for (const s of skus.data ?? []) {
      if (s.load_id == null) continue;
      const list = m.get(s.load_id);
      if (list) list.push(s);
      else m.set(s.load_id, [s]);
    }
    return m;
  }, [skus.data]);

  const rows = useMemo(() => {
    let out = (data ?? []).filter((l) => (showArchived ? l.archived : !l.archived));
    if (statusFilter === "active") {
      out = out.filter((l) => !l.status || !["exception", "delivered"].includes(l.status));
    } else if (statusFilter !== "all") {
      out = out.filter((l) => l.status === statusFilter);
    }
    if (userFilter !== "all") out = out.filter((l) => (l.created_by_name ?? "—") === userFilter);
    return out;
  }, [data, statusFilter, showArchived, userFilter]);

  const statuses = Array.from(new Set((data ?? []).map((l) => l.status).filter(Boolean))) as string[];
  const addedByUsers = Array.from(
    new Set((data ?? []).map((l) => l.created_by_name ?? "—")),
  ).sort();

  const toggle = (id: number | null) => {
    if (id == null) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = rows.length > 0 && rows.every((l) => l.id != null && selected.has(l.id));
  const toggleAll = () => {
    setSelected(() => {
      if (allVisibleSelected) return new Set();
      return new Set(rows.map((l) => l.id).filter((id): id is number => id != null));
    });
  };

  const generateBols = () => {
    const chosen = (data ?? []).filter((l) => l.id != null && selected.has(l.id));
    if (chosen.length > 0) downloadBols(chosen);
  };

  const bulkArchive = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    for (const id of ids) update.mutate({ id, archived: !showArchived });
    setSelected(new Set());
  };

  const bulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} shipment${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    for (const id of ids) del.mutate(id);
    setSelected(new Set());
  };

  const doExport = () =>
    exportCsv(
      rows.map((l) => ({
        ref: l.ref, status: l.status, customer: l.customer_name, carrier: l.carrier_name,
        origin: l.origin_city ? `${l.origin_city}, ${l.origin_state ?? ""}` : l.origin,
        destination: l.dest_city ? `${l.dest_city}, ${l.dest_state ?? ""}` : l.destination,
        miles: l.miles, transport_type: l.transport_type, equipment: l.equipment_type, commodity: l.commodity,
        qty: l.qty, freight_type: l.freight_type,
        sku: l.id != null ? (skusByLoad.get(l.id) ?? []).map((s) => s.sku).join("; ") : "",
        weight_lbs: l.weight_lbs, rate_usd: l.rate_usd, carrier_pay_usd: l.carrier_pay_usd,
        margin_usd: l.margin_usd, bol_number: l.bol_number,
        pickup_at: l.pickup_at, delivery_at: l.delivery_at, age_days: ageDays(l),
        added_by: l.created_by_name,
      })),
      "shipments",
    );

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle="Select shipments with the checkboxes, then Generate BOLs. Click column headers to sort."
        action={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-slate-300" />
              Archived
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active (no delivered/exception)</option>
              <option value="all">All statuses</option>
              {statuses.map((st) => (
                <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              title="Filter by who added the shipment"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Added by: anyone</option>
              {addedByUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button onClick={doExport} {...exportButtonProps(rows.length)}>Export CSV</button>
            {canWrite && (
              <button
                onClick={() => setShowImport(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Import CSV
              </button>
            )}
            <button
              onClick={toggleAll}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {allVisibleSelected ? "Clear selection" : "Select all"}
            </button>
            <button
              onClick={generateBols}
              disabled={selected.size === 0}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Generate BOLs ({selected.size})
            </button>
            {canWrite && (
              <button
                onClick={bulkArchive}
                disabled={selected.size === 0}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                {showArchived ? "Restore" : "Archive"} ({selected.size})
              </button>
            )}
            {canDelete && (
              <button
                onClick={bulkDelete}
                disabled={selected.size === 0}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete ({selected.size})
              </button>
            )}
            {canSku && (
              <button
                onClick={() => {
                  const chosen = (data ?? []).filter((l) => l.id != null && selected.has(l.id));
                  if (chosen.length > 0) setSkuTargets(chosen);
                }}
                disabled={selected.size === 0}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                title="Generate a SKU for each selected shipment"
              >
                Generate SKUs ({selected.size})
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Add shipment
              </button>
            )}
          </div>
        }
      />
      <DataTable<LoadEnriched>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id ?? r.ref ?? Math.random()}
        empty={showArchived ? "No archived shipments." : "No shipments match this filter."}
        columns={[
          {
            header: "",
            cell: (r) => (
              <input
                type="checkbox"
                checked={r.id != null && selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="rounded border-slate-300"
              />
            ),
          },
          { header: "Ref", cell: (r) => <span className="font-medium">{r.ref ?? "—"}</span>, sort: (r) => r.ref },
          { header: "Customer", cell: (r) => r.customer_name ?? "—", sort: (r) => r.customer_name },
          {
            header: "Lane",
            cell: (r) => r.lane ?? `${r.origin_city ?? "?"} → ${r.dest_city ?? "?"}`,
            sort: (r) => r.lane ?? r.origin_city,
          },
          { header: "Miles", cell: (r) => miles(r.miles), sort: (r) => r.miles },
          { header: "Carrier", cell: (r) => r.carrier_name ?? "—", sort: (r) => r.carrier_name },
          { header: "Transport", cell: (r) => r.transport_type ?? "—", sort: (r) => r.transport_type },
          {
            header: "SKU",
            cell: (r) => <SkuCell skus={r.id != null ? (skusByLoad.get(r.id) ?? []) : []} editable={canSku} />,
            sort: (r) => (r.id != null ? skusByLoad.get(r.id)?.[0]?.sku ?? null : null),
          },
          { header: "Equipment", cell: (r) => r.equipment_type ?? "—", sort: (r) => r.equipment_type },
          { header: "Status", cell: (r) => <StatusSelect load={r} disabled={!canWrite} />, sort: (r) => r.status },
          { header: "Pickup", cell: (r) => fmtDateTime(r.pickup_at), sort: (r) => r.pickup_at },
          { header: "Delivery", cell: (r) => fmtDateTime(r.delivery_at), sort: (r) => r.delivery_at },
          { header: "Rate", cell: (r) => money(r.rate_usd), sort: (r) => r.rate_usd },
          {
            header: "Margin",
            cell: (r) =>
              r.margin_usd == null ? (
                "—"
              ) : (
                <span className={r.margin_usd >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                  {money(r.margin_usd)}
                </span>
              ),
            sort: (r) => r.margin_usd,
          },
          {
            header: "Age",
            cell: (r) => {
              const d = ageDays(r);
              if (d == null) return "—";
              const stale = d > 7 && r.status && !DONE_STATUSES.includes(r.status);
              return <span className={stale ? "text-amber-600 font-medium" : ""}>{d}d</span>;
            },
            sort: (r) => ageDays(r),
          },
          {
            header: "Added by",
            cell: (r) => r.created_by_name ?? <span className="text-slate-400">—</span>,
            sort: (r) => r.created_by_name,
          },
          {
            header: "",
            cell: (r) => (
              <div className="flex gap-2 justify-end whitespace-nowrap">
                {canWrite && (
                  <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline text-xs font-medium">
                    Edit
                  </button>
                )}
                <button
                  onClick={() => downloadBols([r])}
                  className="text-slate-500 hover:underline text-xs font-medium"
                  title="Download BOL PDF"
                >
                  BOL
                </button>
                {canWrite && r.id != null && (
                  <button
                    onClick={() => update.mutate({ id: r.id!, archived: !r.archived })}
                    className="text-slate-500 hover:underline text-xs font-medium"
                  >
                    {r.archived ? "Restore" : "Archive"}
                  </button>
                )}
                {canDelete && r.id != null && (
                  <button
                    onClick={() => { if (confirm(`Permanently delete shipment ${r.ref ?? r.id}? This cannot be undone.`)) del.mutate(r.id!); }}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {showAdd && <LoadForm load={null} onClose={() => setShowAdd(false)} />}
      {editing && <LoadForm load={editing} onClose={() => setEditing(null)} />}
      {skuTargets && <GenerateSkusModal loads={skuTargets} onClose={() => setSkuTargets(null)} />}
      {showImport && (
        <ImportCsvModal
          title="Import shipments from CSV"
          fields={[
            { key: "ref", aliases: ["ref", "reference", "load"], required: true },
            { key: "status", aliases: ["status"] },
            { key: "customer", aliases: ["customer", "customer_name"] },
            { key: "carrier", aliases: ["carrier", "carrier_name"] },
            { key: "origin_city", aliases: ["origin_city", "pickup_city"] },
            { key: "origin_state", aliases: ["origin_state", "pickup_state"] },
            { key: "origin_zip", aliases: ["origin_zip", "pickup_zip"] },
            { key: "dest_city", aliases: ["dest_city", "delivery_city", "destination_city"] },
            { key: "dest_state", aliases: ["dest_state", "delivery_state", "destination_state"] },
            { key: "dest_zip", aliases: ["dest_zip", "delivery_zip", "destination_zip"] },
            { key: "transport_type", aliases: ["transport_type", "transport", "transportation"] },
            { key: "equipment", aliases: ["equipment", "equipment_type"] },
            { key: "commodity", aliases: ["commodity"] },
            { key: "weight_lbs", aliases: ["weight_lbs", "weight"] },
            { key: "rate_usd", aliases: ["rate_usd", "rate"] },
            { key: "bol_number", aliases: ["bol_number", "bol"] },
            { key: "pickup_at", aliases: ["pickup_at", "pickup_date"] },
            { key: "delivery_at", aliases: ["delivery_at", "delivery_date"] },
          ]}
          exampleHeader="ref, status, customer, carrier, origin_city, origin_state, origin_zip, dest_city, dest_state, dest_zip, equipment, commodity, weight, rate, bol_number, pickup_date, delivery_date"
          toPayload={(r) => {
            const findByName = <T extends { id: number; name: string | null }>(list: T[], name: string) =>
              name ? list.find((x) => (x.name ?? "").toLowerCase() === name.toLowerCase())?.id ?? null : null;
            const status = LOAD_STATUSES.includes(r.status?.toLowerCase() as never)
              ? r.status.toLowerCase()
              : "pending";
            const transport = TRANSPORT_TYPES.find(
              (t) => t.toLowerCase() === (r.transport_type ?? "").toLowerCase(),
            );
            return {
              transport_type: transport ?? null,
              ref: r.ref,
              status,
              customer_id: findByName(customers.data ?? [], r.customer),
              carrier_id: findByName(carriers.data ?? [], r.carrier),
              origin_city: r.origin_city || null,
              origin_state: r.origin_state || null,
              origin_zip: r.origin_zip || null,
              dest_city: r.dest_city || null,
              dest_state: r.dest_state || null,
              dest_zip: r.dest_zip || null,
              equipment_type: r.equipment || null,
              commodity: r.commodity || null,
              weight_lbs: r.weight_lbs ? Math.round(Number(r.weight_lbs)) || null : null,
              rate_usd: r.rate_usd ? Number(r.rate_usd) || null : null,
              bol_number: r.bol_number || null,
              pickup_at: parseDate(r.pickup_at),
              delivery_at: parseDate(r.delivery_at),
            };
          }}
          onImport={async (importRows) => {
            const { error: e } = await supabase.from("loads").insert(importRows as never);
            if (e) throw e;
            qc.invalidateQueries({ queryKey: ["loads"] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
