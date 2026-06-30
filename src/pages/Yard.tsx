import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

// Yard tables are not in the generated Supabase types yet; use an untyped client for them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (rel: string) => any };

type Trailer = {
  id: number;
  site: string | null;
  trailer_no: string | null;
  carrier_id: number | null;
  status: string | null;
  condition: string | null;
  load_ref: string | null;
  spot: string | null;
  seal_no: string | null;
  contents: string | null;
  gate_in_at: string | null;
  gate_out_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  carrier_name?: string | null;
};

type Carrier = { id: number; name: string | null };

const STATUS_OPTIONS = ["Empty", "Loaded", "Partial", "Out of service", "Reserved"];
const CONDITION_OPTIONS = ["OK", "Damaged", "Needs service"];

const STATUS_STYLES: Record<string, string> = {
  Loaded: "bg-emerald-100 text-emerald-700",
  Empty: "bg-slate-100 text-slate-600",
  Partial: "bg-amber-100 text-amber-700",
  "Out of service": "bg-rose-100 text-rose-700",
  Reserved: "bg-indigo-100 text-indigo-700",
};

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function fmtDT(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString([], { year: "2-digit", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function dwell(t: Trailer): string {
  if (!t.gate_in_at) return "-";
  const start = new Date(t.gate_in_at).getTime();
  if (isNaN(start)) return "-";
  const end = t.gate_out_at ? new Date(t.gate_out_at).getTime() : Date.now();
  const hrs = Math.max(0, Math.round((end - start) / 3600000));
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  const rem = hrs % 24;
  return days + "d " + rem + "h";
}

function dwellHours(t: Trailer): number {
  if (!t.gate_in_at) return 0;
  const start = new Date(t.gate_in_at).getTime();
  if (isNaN(start)) return 0;
  const end = t.gate_out_at ? new Date(t.gate_out_at).getTime() : Date.now();
  return Math.max(0, (end - start) / 3600000);
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status || "Empty";
  const cls = STATUS_STYLES[s] || "bg-slate-100 text-slate-600";
  return <span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-medium " + cls}>{s}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export default function Yard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Trailer | null>(null);

  const trailersQ = useQuery({
    queryKey: ["yard_trailers"],
    queryFn: async () => {
      const { data, error } = await db.from("yard_trailers_enriched")
        .select("*")
        .order("gate_in_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Trailer[];
    },
  });

  const carriersQ = useQuery({
    queryKey: ["carriers", "yard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carriers")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Carrier[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (row: Trailer) => {
      const id = row.id;
      const cleaned = { ...row } as Record<string, unknown>;
      delete cleaned.carrier_name;
      delete cleaned.created_at;
      delete cleaned.updated_at;
      if (id) {
        delete cleaned.id;
        const { error } = await db.from("yard_trailers").update(cleaned).eq("id", id);
        if (error) throw error;
      } else {
        delete cleaned.id;
        const { error } = await db.from("yard_trailers").insert(cleaned);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["yard_trailers"] });
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: unknown) => {
      alert("Could not save trailer. " + (e instanceof Error ? e.message : ""));
    },
  });

  const trailers = trailersQ.data || [];
  const carriers = carriersQ.data || [];

  const sites = useMemo(() => {
    const set = new Set<string>();
    trailers.forEach((t) => { if (t.site) set.add(t.site); });
    return Array.from(set).sort();
  }, [trailers]);

  const filtered = useMemo(() => {
    return trailers.filter((t) => {
      if (siteFilter && t.site !== siteFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [t.trailer_no, t.site, t.carrier_name, t.load_ref, t.spot, t.seal_no, t.contents]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trailers, search, siteFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Trailer[]>();
    filtered.forEach((t) => {
      const key = t.site || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const summary = useMemo(() => {
    const onSite = filtered.filter((t) => !t.gate_out_at);
    return {
      total: onSite.length,
      loaded: onSite.filter((t) => t.status === "Loaded" || t.status === "Partial").length,
      empty: onSite.filter((t) => t.status === "Empty").length,
      oos: onSite.filter((t) => t.status === "Out of service").length,
      siteCount: sites.length,
    };
  }, [filtered, sites]);

  const detail = useMemo(
    () => trailers.find((t) => t.id === detailId) || null,
    [trailers, detailId]
  );

  function openNew() {
    setEditing({
      id: 0,
      site: "",
      trailer_no: "",
      carrier_id: null,
      status: "Empty",
      condition: "OK",
      load_ref: "",
      spot: "",
      seal_no: "",
      contents: "",
      gate_in_at: new Date().toISOString(),
      gate_out_at: null,
      notes: "",
      created_at: null,
      updated_at: null,
    } as Trailer);
    setShowForm(true);
  }

  function openEdit(t: Trailer) {
    setEditing({ ...t });
    setShowForm(true);
    setDetailId(null);
  }

  function set<K extends keyof Trailer>(key: K, val: Trailer[K]) {
    setEditing((prev) => (prev ? { ...prev, [key]: val } : prev));
  }

  const carrierName = (id: number | null) =>
    carriers.find((c) => c.id === id)?.name || "-";

  return (
    <div className="relative">
      <PageHeader
        title="Yard Management"
        subtitle="Track dropped trailers, status, and dwell time by site"
        action={
          <button
            onClick={openNew}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add Trailer
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="On-site trailers" value={summary.total} />
        <SummaryCard label="Loaded / Partial" value={summary.loaded} tone="emerald" />
        <SummaryCard label="Empty" value={summary.empty} tone="slate" />
        <SummaryCard label="Out of service" value={summary.oos} tone="rose" />
        <SummaryCard label="Sites" value={summary.siteCount} tone="indigo" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="Search trailer, site, carrier, load, seal..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} trailers</span>
      </div>

      {trailersQ.isLoading ? (
        <div className="py-12 text-center text-slate-400">Loading yard...</div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center text-slate-400">No trailers found.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([site, list]) => (
            <div key={site} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-slate-700">{site}</h3>
                <span className="text-xs text-slate-400">
                  {list.filter((t) => !t.gate_out_at).length} on-site / {list.length} total
                </span>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2">Trailer</th>
                    <th className="px-4 py-2">Carrier</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Condition</th>
                    <th className="px-4 py-2">Spot</th>
                    <th className="px-4 py-2">Load Ref</th>
                    <th className="px-4 py-2">Gate In</th>
                    <th className="px-4 py-2">Dwell</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setDetailId(t.id)}
                      className={
                        "cursor-pointer border-b border-slate-50 hover:bg-slate-50 " +
                        (t.gate_out_at ? "text-slate-400" : "text-slate-700")
                      }
                    >
                      <td className="px-4 py-2.5 font-medium">{t.trailer_no || "-"}</td>
                      <td className="px-4 py-2.5">{t.carrier_name || "-"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-2.5">{t.condition || "-"}</td>
                      <td className="px-4 py-2.5">{t.spot || "-"}</td>
                      <td className="px-4 py-2.5">{t.load_ref || "-"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{fmtDT(t.gate_in_at)}</td>
                      <td className={"px-4 py-2.5 whitespace-nowrap font-medium " + (dwellHours(t) >= 48 && !t.gate_out_at ? "text-rose-600" : "")}>
                        {t.gate_out_at ? "Gated out" : dwell(t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Trailer</div>
              <h2 className="text-xl font-semibold text-slate-800">{detail.trailer_no || "-"}</h2>
              <div className="mt-1 text-sm text-slate-500">{detail.site || "Unassigned"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEdit(detail)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                onClick={() => setDetailId(null)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
              >
                {"\u2715"}
              </button>
            </div>
          </div>
          <div className="mb-4"><StatusBadge status={detail.status} /></div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DField label="Carrier" value={detail.carrier_name || carrierName(detail.carrier_id)} />
            <DField label="Condition" value={detail.condition || "-"} />
            <DField label="Spot" value={detail.spot || "-"} />
            <DField label="Seal #" value={detail.seal_no || "-"} />
            <DField label="Load Ref" value={detail.load_ref || "-"} />
            <DField label="Dwell" value={detail.gate_out_at ? "Gated out" : dwell(detail)} />
            <DField label="Gate In" value={fmtDT(detail.gate_in_at)} />
            <DField label="Gate Out" value={fmtDT(detail.gate_out_at)} />
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Contents</div>
            <div className="text-sm text-slate-700">{detail.contents || "-"}</div>
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Notes</div>
            <div className="text-sm text-slate-700">{detail.notes || "-"}</div>
          </div>
        </div>
      )}

      {showForm && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {editing.id ? "Edit Trailer" : "Add Trailer"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Site / Yard">
                <input className={inp} value={editing.site || ""} onChange={(e) => set("site", e.target.value)} />
              </Field>
              <Field label="Trailer Number">
                <input className={inp} value={editing.trailer_no || ""} onChange={(e) => set("trailer_no", e.target.value)} />
              </Field>
              <Field label="Carrier">
                <select
                  className={inp}
                  value={editing.carrier_id ?? ""}
                  onChange={(e) => set("carrier_id", e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">- none -</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className={inp} value={editing.status || "Empty"} onChange={(e) => set("status", e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Condition">
                <select className={inp} value={editing.condition || "OK"} onChange={(e) => set("condition", e.target.value)}>
                  {CONDITION_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Spot / Location">
                <input className={inp} value={editing.spot || ""} onChange={(e) => set("spot", e.target.value)} />
              </Field>
              <Field label="Load Ref">
                <input className={inp} value={editing.load_ref || ""} onChange={(e) => set("load_ref", e.target.value)} />
              </Field>
              <Field label="Seal #">
                <input className={inp} value={editing.seal_no || ""} onChange={(e) => set("seal_no", e.target.value)} />
              </Field>
              <Field label="Gate In">
                <input
                  type="datetime-local"
                  className={inp}
                  value={toLocalInput(editing.gate_in_at)}
                  onChange={(e) => set("gate_in_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </Field>
              <Field label="Gate Out">
                <input
                  type="datetime-local"
                  className={inp}
                  value={toLocalInput(editing.gate_out_at)}
                  onChange={(e) => set("gate_out_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <Field label="Contents">
                <input className={inp} value={editing.contents || ""} onChange={(e) => set("contents", e.target.value)} />
              </Field>
              <Field label="Notes">
                <textarea className={inp} rows={2} value={editing.notes || ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => editing && saveMut.mutate(editing)}
                disabled={saveMut.isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saveMut.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600" :
    tone === "rose" ? "text-rose-600" :
    tone === "indigo" ? "text-indigo-600" :
    "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={"mt-1 text-2xl font-semibold " + toneCls}>{value}</div>
    </div>
  );
}

function DField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}
