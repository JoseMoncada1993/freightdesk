import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import ImportCsvModal from "@/components/ImportCsvModal";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useAddTrailer, useUpdateTrailer, useYardTrailers } from "@/hooks/useYard";
import { useCarriers } from "@/hooks/useTables";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import { TRAILER_STATUSES } from "@/lib/types";
import type { YardTrailerEnriched } from "@/lib/types";

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

/** ISO timestamp → value for <input type="datetime-local"> in local time. */
const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const hoursInYard = (t: YardTrailerEnriched) => {
  if (!t.gate_in_at || t.gate_out_at) return null;
  return Math.round((Date.now() - new Date(t.gate_in_at).getTime()) / 36e5);
};

function TrailerForm({
  trailer,
  onClose,
}: {
  trailer: YardTrailerEnriched | null;
  onClose: () => void;
}) {
  const carriers = useCarriers();
  const add = useAddTrailer();
  const update = useUpdateTrailer();
  const editing = trailer != null;

  const [site, setSite] = useState(trailer?.site ?? "");
  const [trailerNo, setTrailerNo] = useState(trailer?.trailer_no ?? "");
  const [carrierId, setCarrierId] = useState(trailer?.carrier_id ? String(trailer.carrier_id) : "");
  const [status, setStatus] = useState(trailer?.status ?? "Empty");
  const [spot, setSpot] = useState(trailer?.spot ?? "");
  const [sealNo, setSealNo] = useState(trailer?.seal_no ?? "");
  const [loadRef, setLoadRef] = useState(trailer?.load_ref ?? "");
  const [contents, setContents] = useState(trailer?.contents ?? "");
  const [notes, setNotes] = useState(trailer?.notes ?? "");
  const [gateIn, setGateIn] = useState(
    trailer ? toLocalInput(trailer.gate_in_at) : toLocalInput(new Date().toISOString()),
  );
  const [gateOut, setGateOut] = useState(toLocalInput(trailer?.gate_out_at));

  const pending = add.isPending || update.isPending;
  const canSubmit = site.trim() !== "" && trailerNo.trim() !== "" && !pending;

  const handleSubmit = () => {
    const payload = {
      site: site.trim(),
      trailer_no: trailerNo.trim(),
      carrier_id: carrierId ? Number(carrierId) : null,
      status,
      spot: spot.trim() || null,
      seal_no: sealNo.trim() || null,
      load_ref: loadRef.trim() || null,
      contents: contents.trim() || null,
      notes: notes.trim() || null,
      gate_in_at: fromLocalInput(gateIn),
      ...(editing ? { gate_out_at: fromLocalInput(gateOut) } : {}),
    };
    if (editing && trailer.id != null) {
      update.mutate({ id: trailer.id, ...payload }, { onSuccess: onClose });
    } else {
      add.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Modal
      title={editing ? `Edit trailer ${trailer.trailer_no}` : "Gate in trailer"}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save changes" : "Gate in"}
          pending={pending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Site / yard *">
          <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="ATL-01" className={inputCls} />
        </Field>
        <Field label="Trailer # *">
          <input value={trailerNo} onChange={(e) => setTrailerNo(e.target.value)} placeholder="TRL-53102" className={inputCls} />
        </Field>
        <Field label="Carrier">
          <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {(carriers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {TRAILER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Spot">
          <input value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="A-04" className={inputCls} />
        </Field>
        <Field label="Seal #">
          <input value={sealNo} onChange={(e) => setSealNo(e.target.value)} placeholder="SL-88121" className={inputCls} />
        </Field>
        <Field label="Load ref">
          <input value={loadRef} onChange={(e) => setLoadRef(e.target.value)} placeholder="LD-2101" className={inputCls} />
        </Field>
        <Field label="Contents">
          <input value={contents} onChange={(e) => setContents(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Gate in">
          <input
            type="datetime-local"
            value={gateIn}
            onChange={(e) => setGateIn(e.target.value)}
            className={inputCls}
          />
        </Field>
        {editing && (
          <Field label="Gate out (leave blank if still in yard)">
            <input
              type="datetime-local"
              value={gateOut}
              onChange={(e) => setGateOut(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <ErrorText error={add.error ?? update.error} />
    </Modal>
  );
}

export default function Trailers() {
  const { data, isLoading, error } = useYardTrailers();
  const update = useUpdateTrailer();
  const qc = useQueryClient();
  const carriers = useCarriers();
  const { can } = useAuth();
  const canWrite = can("trailers");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<YardTrailerEnriched | null>(null);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Only offer sites that exist in the current view (archived vs active),
  // so archived-only sites don't clutter the filter.
  const sites = useMemo(
    () =>
      Array.from(
        new Set(
          (data ?? [])
            .filter((t) => (showArchived ? t.archived : !t.archived))
            .map((t) => t.site)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [data, showArchived],
  );

  // If the selected site disappears (e.g. archived toggle flipped), reset it.
  useEffect(() => {
    if (siteFilter !== "all" && !sites.includes(siteFilter)) setSiteFilter("all");
  }, [sites, siteFilter]);

  const rows = useMemo(() => {
    let out = (data ?? []).filter((t) => (showArchived ? t.archived : !t.archived));
    if (siteFilter !== "all") out = out.filter((t) => t.site === siteFilter);
    if (statusFilter !== "all") out = out.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((t) =>
        [t.trailer_no, t.site, t.spot, t.carrier_name, t.load_ref, t.seal_no, t.contents, t.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return out;
  }, [data, search, siteFilter, statusFilter, showArchived]);

  const inYard = (data ?? []).filter((t) => !t.gate_out_at && !t.archived);
  const count = (s: string) => inYard.filter((t) => t.status === s).length;
  const stale = inYard.filter((t) => (hoursInYard(t) ?? 0) > 48).length;

  // Per-site breakdown of trailers currently in the yard
  const breakdown = useMemo(() => {
    const by = new Map<string, { total: number; loaded: number; empty: number; oos: number }>();
    for (const t of inYard) {
      const key = t.site ?? "?";
      const b = by.get(key) ?? { total: 0, loaded: 0, empty: 0, oos: 0 };
      b.total++;
      if (t.status === "Loaded") b.loaded++;
      if (t.status === "Empty") b.empty++;
      if (t.status === "Out of service") b.oos++;
      by.set(key, b);
    }
    return Array.from(by, ([site, b]) => ({ site, ...b })).sort((a, b2) => a.site.localeCompare(b2.site));
  }, [inYard]);

  const gateOut = (t: YardTrailerEnriched) => {
    if (t.id == null) return;
    update.mutate({ id: t.id, gate_out_at: new Date().toISOString() });
  };

  const doExport = () =>
    exportCsv(
      rows.map((t) => ({
        trailer_no: t.trailer_no, site: t.site, spot: t.spot, carrier: t.carrier_name,
        status: t.status, condition: t.condition, load_ref: t.load_ref, seal_no: t.seal_no,
        contents: t.contents, gate_in: t.gate_in_at, gate_out: t.gate_out_at,
        dwell_hours: hoursInYard(t), notes: t.notes,
      })),
      "drop_trailers",
    );

  return (
    <div>
      <PageHeader
        title="Drop Trailers"
        subtitle="Yard board — search, filter by site/status, click headers to sort"
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={doExport} {...exportButtonProps(rows.length)}>Export CSV</button>
            {canWrite && (
              <button
                onClick={() => setShowImport(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Import CSV
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Gate in trailer
              </button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <StatCard label="In yard" value={isLoading ? "…" : inYard.length} />
        <StatCard label="Loaded" value={isLoading ? "…" : count("Loaded")} />
        <StatCard label="Empty" value={isLoading ? "…" : count("Empty")} />
        <StatCard label="Out of service" value={isLoading ? "…" : count("Out of service")} />
        <StatCard label="Aging 48h+" value={isLoading ? "…" : stale} hint="still in yard" />
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showBreakdown ? "Hide breakdown by site ▲" : "Show breakdown by site ▼"}
        </button>
        {showBreakdown && (
          <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Site</th>
                  <th className="px-4 py-2 font-medium">In yard</th>
                  <th className="px-4 py-2 font-medium">Loaded</th>
                  <th className="px-4 py-2 font-medium">Empty</th>
                  <th className="px-4 py-2 font-medium">Out of service</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b) => (
                  <tr key={b.site} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">
                      <button onClick={() => setSiteFilter(b.site)} className="text-blue-600 hover:underline">
                        {b.site}
                      </button>
                    </td>
                    <td className="px-4 py-2">{b.total}</td>
                    <td className="px-4 py-2">{b.loaded}</td>
                    <td className="px-4 py-2">{b.empty}</td>
                    <td className="px-4 py-2">{b.oos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trailer #, spot, carrier, seal…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {TRAILER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-slate-300" />
          Archived
        </label>
      </div>

      <DataTable<YardTrailerEnriched>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id ?? Math.random()}
        empty={showArchived ? "No archived trailers." : "No trailers match this filter."}
        columns={[
          { header: "Trailer #", cell: (r) => <span className="font-medium">{r.trailer_no}</span>, sort: (r) => r.trailer_no },
          { header: "Site", cell: (r) => r.site ?? "—", sort: (r) => r.site },
          { header: "Spot", cell: (r) => r.spot ?? "—", sort: (r) => r.spot },
          { header: "Carrier", cell: (r) => r.carrier_name ?? "—", sort: (r) => r.carrier_name },
          { header: "Status", cell: (r) => <Badge value={r.status} />, sort: (r) => r.status },
          { header: "Load ref", cell: (r) => r.load_ref ?? "—", sort: (r) => r.load_ref },
          { header: "Seal #", cell: (r) => r.seal_no ?? "—" },
          { header: "Gate in", cell: (r) => fmtDate(r.gate_in_at), sort: (r) => r.gate_in_at },
          {
            header: "Dwell",
            cell: (r) => {
              const h = hoursInYard(r);
              if (h == null) return r.gate_out_at ? "departed" : "—";
              return <span className={h > 48 ? "text-red-600 font-medium" : ""}>{h}h</span>;
            },
            sort: (r) => hoursInYard(r),
          },
          {
            header: "",
            cell: (r) =>
              canWrite ? (
                <div className="flex gap-2 justify-end whitespace-nowrap">
                  <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline text-xs font-medium">
                    Edit
                  </button>
                  {!r.gate_out_at && (
                    <button onClick={() => gateOut(r)} className="text-slate-500 hover:underline text-xs font-medium">
                      Gate out
                    </button>
                  )}
                  {r.gate_out_at && r.id != null && (
                    <button
                      onClick={() => update.mutate({ id: r.id!, archived: !r.archived })}
                      className="text-slate-500 hover:underline text-xs font-medium"
                    >
                      {r.archived ? "Restore" : "Archive"}
                    </button>
                  )}
                </div>
              ) : null,
          },
        ]}
      />
      {showAdd && <TrailerForm trailer={null} onClose={() => setShowAdd(false)} />}
      {editing && <TrailerForm trailer={editing} onClose={() => setEditing(null)} />}
      {showImport && (
        <ImportCsvModal
          title="Import drop trailers from CSV"
          fields={[
            { key: "site", aliases: ["site", "yard"], required: true },
            { key: "trailer_no", aliases: ["trailer_no", "trailer", "trailer_number", "trailer #"], required: true },
            { key: "carrier", aliases: ["carrier", "carrier_name"] },
            { key: "status", aliases: ["status"] },
            { key: "spot", aliases: ["spot", "location"] },
            { key: "seal_no", aliases: ["seal_no", "seal"] },
            { key: "load_ref", aliases: ["load_ref", "load"] },
            { key: "contents", aliases: ["contents"] },
            { key: "gate_in", aliases: ["gate_in", "gate_in_at", "gate in"] },
            { key: "notes", aliases: ["notes"] },
          ]}
          exampleHeader="site, trailer_no, carrier, status, spot, seal_no, load_ref, contents, gate_in, notes"
          toPayload={(r) => {
            const carrier = (carriers.data ?? []).find(
              (c) => c.name.trim().toLowerCase() === (r.carrier ?? "").trim().toLowerCase(),
            );
            const status = TRAILER_STATUSES.find(
              (s) => s.toLowerCase() === (r.status ?? "").trim().toLowerCase(),
            );
            const gateIn =
              r.gate_in && !Number.isNaN(new Date(r.gate_in).getTime())
                ? new Date(r.gate_in).toISOString()
                : new Date().toISOString();
            return {
              site: r.site,
              trailer_no: r.trailer_no,
              carrier_id: carrier?.id ?? null,
              status: status ?? "Empty",
              spot: r.spot || null,
              seal_no: r.seal_no || null,
              load_ref: r.load_ref || null,
              contents: r.contents || null,
              gate_in_at: gateIn,
              notes: r.notes || null,
            };
          }}
          onImport={async (importRows) => {
            const { error: e } = await supabase.from("yard_trailers").insert(importRows as never);
            if (e) throw e;
            qc.invalidateQueries({ queryKey: ["yard_trailers"] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
