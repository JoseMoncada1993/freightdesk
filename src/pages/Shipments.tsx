import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { estimateMiles, suggestedTotal } from "@/lib/miles";

type Shipment = {
  id: number;
  ref: string | null;
  status: string | null;
  rate_usd: number | null;
  rate_per_mile: number | null;
  miles_calc: number | null;
  created_at: string | null;
  customer_id: number | null;
  carrier_id: number | null;
  carrier_name: string | null;
  entity: string | null;
  equipment_type: string | null;
  bol_number: string | null;
  commodity: string | null;
  origin: string | null;
  destination: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_zip: string | null;
  dest_city: string | null;
  dest_state: string | null;
  dest_zip: string | null;
  shipper_name: string | null;
  shipper_address1: string | null;
  shipper_address2: string | null;
  shipper_city: string | null;
  shipper_state: string | null;
  shipper_zip: string | null;
  shipper_contact: string | null;
  shipper_phone: string | null;
  consignee_name: string | null;
  consignee_address1: string | null;
  consignee_address2: string | null;
  consignee_city: string | null;
  consignee_state: string | null;
  consignee_zip: string | null;
  consignee_contact: string | null;
  consignee_phone: string | null;
  pickup_at: string | null;
  eta: string | null;
  delivered_at: string | null;
  scheduled_at: string | null;
  delivery_at: string | null;
  notes: string | null;
};

type Customer = {
  id: number;
  name: string | null;
  company_name: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

const STATUS_STEPS = [
  "Quoted",
  "Shipment approved",
  "BOL approved",
  "BOL sent",
  "Shipment booked",
  "Delivered",
];

// Map free-form / legacy statuses onto the progress step index.
function statusStepIndex(status: string | null): number {
  const s = (status || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!s) return 0;
  if (s.includes("deliver")) return 5;
  if (s.includes("book")) return 4;
  if (s.includes("bol sent") || s.includes("sent")) return 3;
  if (s.includes("bol")) return 2;
  if (s.includes("approve")) return 1;
  if (s.includes("transit")) return 4;
  if (s.includes("quote")) return 0;
  return 0;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

function money(n: number | null | undefined): string {
  if (n == null) return "-";
  return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
function fmtDT(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString([], { year: "2-digit", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function cityLine(city: string | null, state: string | null, zip: string | null): string {
  const parts = [city, state].filter(Boolean).join(", ");
  return [zip, parts].filter(Boolean).join(" ");
}

const STATUS_OPTIONS = [
  "Quoted",
  "Shipment approved",
  "BOL approved",
  "BOL sent",
  "Shipment booked",
  "in_transit",
  "delayed",
  "exception",
  "delivered",
];

const ENTITY_OPTIONS = ["", "Broker", "Carrier", "Freight Forwarder", "Owner Operator"];
const EQUIP_OPTIONS = ["", "LTL", "FTL", "Reefer", "Flatbed", "Drayage", "Partial"];

export default function Shipments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Shipment | null>(null);
  const [showForm, setShowForm] = useState(false);

  const shipmentsQ = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loads_enriched")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Shipment[];
    },
  });

  const customersQ = useQuery({
    queryKey: ["customers", "for-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,company_name,address1,city,state,zip_code,contact_phone,contact_email")
        .order("name");
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });

  const carriersQ = useQuery({
    queryKey: ["carriers", "for-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carriers")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: number; name: string | null }[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Shipment> & { id?: number }) => {
      const { id, ...fields } = payload;
      // strip view-only columns that are not real columns on loads
      const cleaned: Record<string, unknown> = { ...fields };
      delete cleaned.carrier_name;
      delete cleaned.carrier_mode;
      delete cleaned.origin;
      delete cleaned.destination;
      delete cleaned.lane;
      delete cleaned.miles;
      delete (cleaned as Record<string, unknown>)._miles;
      delete (cleaned as Record<string, unknown>)._suggested;
      if (id) {
        const { error } = await supabase.from("loads").update(cleaned as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loads").insert(cleaned as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const rows = shipmentsQ.data || [];
  const customers = customersQ.data || [];
  const carriers = carriersQ.data || [];

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const oZip = r.origin_zip || r.shipper_zip;
      const dZip = r.dest_zip || r.consignee_zip;
      const calcMiles = r.miles_calc ?? estimateMiles(oZip, dZip);
      const suggested = suggestedTotal(calcMiles, r.rate_per_mile);
      return { ...r, _miles: calcMiles, _suggested: suggested };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (statusFilter && (r.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (entityFilter && (r.entity || "") !== entityFilter) return false;
      if (!q) return true;
      const hay = [
        r.ref, r.bol_number, r.carrier_name, r.entity, r.equipment_type,
        r.origin_city, r.dest_city, r.origin_zip, r.dest_zip,
        r.shipper_name, r.consignee_name, r.commodity,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [enriched, search, statusFilter, entityFilter]);

  const detail = useMemo(
    () => enriched.find((r) => r.id === detailId) || null,
    [enriched, detailId]
  );

  function toggleSel(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function generateBOL() {
    const chosen = enriched.filter((r) => selected.has(r.id));
    if (chosen.length === 0) return;
    const html = bolHtml(chosen);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function openNew() {
    setEditing({
      id: 0 as number,
      ref: "", status: "Quoted", rate_usd: null, rate_per_mile: null,
      miles_calc: null, created_at: null, customer_id: null, carrier_id: null,
      carrier_name: null, entity: "", equipment_type: "LTL", bol_number: "",
      commodity: "", origin: null, destination: null,
      origin_city: "", origin_state: "", origin_zip: "",
      dest_city: "", dest_state: "", dest_zip: "",
      shipper_name: "", shipper_address1: "", shipper_address2: "",
      shipper_city: "", shipper_state: "", shipper_zip: "",
      shipper_contact: "", shipper_phone: "",
      consignee_name: "", consignee_address1: "", consignee_address2: "",
      consignee_city: "", consignee_state: "", consignee_zip: "",
      consignee_contact: "", consignee_phone: "",
      pickup_at: null, eta: null, delivered_at: null, scheduled_at: null, delivery_at: null, notes: "",
    } as Shipment);
    setShowForm(true);
  }

  function applyCustomerToShipper(custId: number) {
    const c = customers.find((x) => x.id === custId);
    if (!c || !editing) return;
    setEditing({
      ...editing,
      customer_id: custId,
      shipper_name: c.company_name || c.name || "",
      shipper_address1: c.address1 || "",
      shipper_city: c.city || "",
      shipper_state: c.state || "",
      shipper_zip: c.zip_code || "",
      shipper_phone: c.contact_phone || "",
      origin_city: c.city || "",
      origin_state: c.state || "",
      origin_zip: c.zip_code || "",
    });
  }

  function applyCustomerToConsignee(custId: number) {
    const c = customers.find((x) => x.id === custId);
    if (!c || !editing) return;
    setEditing({
      ...editing,
      consignee_name: c.company_name || c.name || "",
      consignee_address1: c.address1 || "",
      consignee_city: c.city || "",
      consignee_state: c.state || "",
      consignee_zip: c.zip_code || "",
      consignee_phone: c.contact_phone || "",
      dest_city: c.city || "",
      dest_state: c.state || "",
      dest_zip: c.zip_code || "",
    });
  }

  function set<K extends keyof Shipment>(key: K, val: Shipment[K]) {
    setEditing((prev) => (prev ? { ...prev, [key]: val } : prev));
  }

  function submitForm() {
    if (!editing) return;
    const miles = editing.miles_calc ?? estimateMiles(editing.origin_zip, editing.dest_zip);
    const payload: Partial<Shipment> & { id?: number } = {
      ...editing,
      miles_calc: miles,
    };
    if (!editing.id) delete payload.id;
    delete (payload as Record<string, unknown>).created_at;
    saveMut.mutate(payload);
  }

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle="TMS shipment board - quote, book, and generate BOLs"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={generateBOL}
              disabled={selected.size === 0}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Generate BOL{selected.size ? " (" + selected.size + ")" : ""}
            </button>
            <button
              onClick={openNew}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              New Shipment
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ref, BOL, carrier, city, zip..."
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All entities</option>
          {ENTITY_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} shipments</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3"></th>
              <th className="px-3 py-3 font-medium">Ref</th>
              <th className="px-3 py-3 font-medium">Age</th>
              <th className="px-3 py-3 font-medium">Entity</th>
              <th className="px-3 py-3 font-medium">Carrier</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">BOL</th>
              <th className="px-3 py-3 font-medium">Origin</th>
              <th className="px-3 py-3 font-medium">Destination</th>
              <th className="px-3 py-3 font-medium">Miles</th>
              <th className="px-3 py-3 font-medium">Suggested</th>
              <th className="px-3 py-3 font-medium">Rate</th>
              <th className="px-3 py-3 font-medium">Scheduled</th>
                  <th className="px-3 py-3 font-medium">Delivery</th>
                  <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipmentsQ.isLoading && (
              <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            )}
            {shipmentsQ.error && (
              <tr><td colSpan={15} className="px-4 py-8 text-center text-red-600">Failed to load shipments.</td></tr>
            )}
            {!shipmentsQ.isLoading && filtered.length === 0 && (
              <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-400">No shipments match.</td></tr>
            )}
            {filtered.map((r) => {
              const age = daysSince(r.created_at);
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => setDetailId(r.id)}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSel(r.id)}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900">{r.ref || "-"}</td>
                  <td className="px-3 py-3 text-slate-500">{age == null ? "-" : age + "d"}</td>
                  <td className="px-3 py-3">{r.entity || "-"}</td>
                  <td className="px-3 py-3">{r.carrier_name || "-"}</td>
                  <td className="px-3 py-3">{r.equipment_type || "-"}</td>
                  <td className="px-3 py-3">{r.bol_number || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{cityLine(r.origin_city, r.origin_state, r.origin_zip) || cityLine(r.shipper_city, r.shipper_state, r.shipper_zip) || r.origin || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{cityLine(r.dest_city, r.dest_state, r.dest_zip) || cityLine(r.consignee_city, r.consignee_state, r.consignee_zip) || r.destination || "-"}</td>
                  <td className="px-3 py-3">{r._miles == null ? "-" : r._miles + " mi"}</td>
                  <td className="px-3 py-3 text-slate-600">{money(r._suggested)}</td>
                  <td className="px-3 py-3">{money(r.rate_usd)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{fmtDT(r.scheduled_at)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{fmtDT(r.delivery_at)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setDetailId(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Shipment</div>
                <h2 className="text-xl font-semibold text-slate-900">{detail.ref || "-"}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing(detail); setShowForm(true); }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                >
                  Edit
                </button>
                <button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-slate-700">{"\u2715"}</button>
              </div>
            </div>

            <StatusTracker status={detail.status} />

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-400">Entity</div>
                <div>{detail.entity || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">Type</div>
                <div>{detail.equipment_type || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">Carrier</div>
                <div>{detail.carrier_name || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">BOL #</div>
                <div>{detail.bol_number || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">Miles</div>
                <div>{detail._miles == null ? "-" : detail._miles + " mi"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">Suggested / Actual</div>
                <div>{money(detail._suggested)} / {money(detail.rate_usd)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">Scheduled</div>
                <div>{fmtDT(detail.scheduled_at)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">Delivery</div>
                <div>{fmtDT(detail.delivery_at)}</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Shipper</div>
                <div className="font-medium">{detail.shipper_name || "-"}</div>
                <div className="text-slate-600">{detail.shipper_address1}</div>
                <div className="text-slate-600">{cityLine(detail.shipper_city, detail.shipper_state, detail.shipper_zip)}</div>
                <div className="mt-1 text-slate-500">{detail.shipper_phone}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Consignee</div>
                <div className="font-medium">{detail.consignee_name || "-"}</div>
                <div className="text-slate-600">{detail.consignee_address1}</div>
                <div className="text-slate-600">{cityLine(detail.consignee_city, detail.consignee_state, detail.consignee_zip)}</div>
                <div className="mt-1 text-slate-500">{detail.consignee_phone}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase text-slate-400">Commodity</div>
              <div className="text-sm">{detail.commodity || "-"}</div>
            </div>
            {detail.notes && (
              <div className="mt-4">
                <div className="text-xs uppercase text-slate-400">Notes</div>
                <div className="text-sm text-slate-600">{detail.notes}</div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => { setSelected(new Set([detail.id])); generateBOL(); }}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
              >
                Generate BOL for this shipment
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6">
          <div className="my-6 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing.id ? "Edit Shipment" : "New Shipment"}</h2>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <Field label="Reference">
                <input className={inp} value={editing.ref || ""} onChange={(e) => set("ref", e.target.value)} />
              </Field>
              <Field label="Status">
                <select className={inp} value={editing.status || ""} onChange={(e) => set("status", e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Entity">
                <select className={inp} value={editing.entity || ""} onChange={(e) => set("entity", e.target.value)}>
                  {ENTITY_OPTIONS.map((s) => <option key={s} value={s}>{s || "-"}</option>)}
                </select>
              </Field>
              <Field label="Equipment Type">
                <select className={inp} value={editing.equipment_type || ""} onChange={(e) => set("equipment_type", e.target.value)}>
                  {EQUIP_OPTIONS.map((s) => <option key={s} value={s}>{s || "-"}</option>)}
                </select>
              </Field>
              <Field label="Carrier">
                <select className={inp} value={editing.carrier_id ?? ""} onChange={(e) => set("carrier_id", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">-</option>
                  {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="BOL #">
                <input className={inp} value={editing.bol_number || ""} onChange={(e) => set("bol_number", e.target.value)} />
              </Field>
              <Field label="Rate (actual $)">
                <input type="number" className={inp} value={editing.rate_usd ?? ""} onChange={(e) => set("rate_usd", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Rate per mile ($)">
                <input type="number" className={inp} value={editing.rate_per_mile ?? ""} onChange={(e) => set("rate_per_mile", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Commodity">
                <input className={inp} value={editing.commodity || ""} onChange={(e) => set("commodity", e.target.value)} />
              </Field>
              <Field label="Scheduled (pickup)">
                <input type="datetime-local" className={inp} value={toLocalInput(editing.scheduled_at)} onChange={(e) => set("scheduled_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </Field>
              <Field label="Delivery">
                <input type="datetime-local" className={inp} value={toLocalInput(editing.delivery_at)} onChange={(e) => set("delivery_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </Field>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">Shipper (Pickup)</span>
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    value=""
                    onChange={(e) => e.target.value && applyCustomerToShipper(Number(e.target.value))}
                  >
                    <option value="">Auto-fill from customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
                  </select>
                </div>
                <input className={inp + " mb-2"} placeholder="Name" value={editing.shipper_name || ""} onChange={(e) => set("shipper_name", e.target.value)} />
                <input className={inp + " mb-2"} placeholder="Address" value={editing.shipper_address1 || ""} onChange={(e) => set("shipper_address1", e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inp} placeholder="City" value={editing.shipper_city || ""} onChange={(e) => set("shipper_city", e.target.value)} />
                  <input className={inp} placeholder="State" value={editing.shipper_state || ""} onChange={(e) => set("shipper_state", e.target.value)} />
                  <input className={inp} placeholder="Zip" value={editing.shipper_zip || ""} onChange={(e) => set("shipper_zip", e.target.value)} />
                </div>
                <input className={inp + " mt-2"} placeholder="Phone" value={editing.shipper_phone || ""} onChange={(e) => set("shipper_phone", e.target.value)} />
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">Consignee (Ship-to)</span>
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    value=""
                    onChange={(e) => e.target.value && applyCustomerToConsignee(Number(e.target.value))}
                  >
                    <option value="">Auto-fill from customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
                  </select>
                </div>
                <input className={inp + " mb-2"} placeholder="Name" value={editing.consignee_name || ""} onChange={(e) => set("consignee_name", e.target.value)} />
                <input className={inp + " mb-2"} placeholder="Address" value={editing.consignee_address1 || ""} onChange={(e) => set("consignee_address1", e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inp} placeholder="City" value={editing.consignee_city || ""} onChange={(e) => set("consignee_city", e.target.value)} />
                  <input className={inp} placeholder="State" value={editing.consignee_state || ""} onChange={(e) => set("consignee_state", e.target.value)} />
                  <input className={inp} placeholder="Zip" value={editing.consignee_zip || ""} onChange={(e) => set("consignee_zip", e.target.value)} />
                </div>
                <input className={inp + " mt-2"} placeholder="Phone" value={editing.consignee_phone || ""} onChange={(e) => set("consignee_phone", e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea className={inp} rows={2} value={editing.notes || ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>

            {saveMut.isError && (
              <div className="mt-3 text-sm text-red-600">Could not save. Please try again.</div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitForm} disabled={saveMut.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saveMut.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "").toLowerCase();
  let cls = "bg-slate-100 text-slate-600";
  if (s.includes("deliver")) cls = "bg-blue-100 text-blue-700";
  else if (s.includes("transit") || s.includes("out for")) cls = "bg-green-100 text-green-700";
  else if (s.includes("delay") || s.includes("exception") || s.includes("arrived")) cls = "bg-red-100 text-red-700";
  else if (s.includes("book")) cls = "bg-indigo-100 text-indigo-700";
  return (
    <span className={"inline-block rounded-full px-2.5 py-1 text-xs font-medium " + cls}>
      {status || "-"}
    </span>
  );
}

function StatusTracker({ status }: { status: string | null }) {
  const active = statusStepIndex(status);
  return (
    <div className="flex items-center">
      {STATUS_STEPS.map((label, i) => {
        const done = i <= active;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={"h-0.5 flex-1 " + (i === 0 ? "bg-transparent" : done ? "bg-blue-500" : "bg-slate-200")} />
              <div className={"flex h-6 w-6 items-center justify-center rounded-full text-xs " + (done ? "bg-blue-500 text-white" : "border border-slate-300 bg-white text-slate-300")}>
                {done ? "\u2713" : ""}
              </div>
              <div className={"h-0.5 flex-1 " + (i === STATUS_STEPS.length - 1 ? "bg-transparent" : i < active ? "bg-blue-500" : "bg-slate-200")} />
            </div>
            <span className="mt-1 text-center text-[10px] leading-tight text-slate-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function bolHtml(list: Shipment[]): string {
  const esc2 = (v: unknown): string =>
    String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c] as string);
  const today = new Date().toLocaleDateString();
  const inputCss =
    "border:none;border-bottom:1px solid #999;font:inherit;width:95%;padding:1px 2px;background:transparent;";
  const ta =
    "border:none;font:inherit;width:98%;min-height:34px;resize:none;background:transparent;";
  const ti = (val: string, w?: string) =>
    '<input style="' + inputCss + (w ? "width:" + w + ";" : "") + '" value="' + esc2(val) + '"/>';
  const pages = list
    .map((r, idx) => {
      const shipFrom = [r.shipper_name, r.shipper_address1, [r.shipper_city, r.shipper_state, r.shipper_zip].filter(Boolean).join(", "), r.shipper_phone ? "Phone# " + r.shipper_phone : ""].filter(Boolean).join("\n");
      const shipTo = [r.consignee_name, r.consignee_address1, [r.consignee_city, r.consignee_state, r.consignee_zip].filter(Boolean).join(", "), r.consignee_phone ? "Phone# " + r.consignee_phone : ""].filter(Boolean).join("\n");
      const cellB = "border:1px solid #000;padding:4px 6px;vertical-align:top;";
      const hdr = "background:#fff;font-weight:bold;border:1px solid #000;padding:3px 6px;";
      return (
        '<div class="page" style="page-break-after:always;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;width:1000px;margin:0 auto 24px;">' +
          '<table style="width:100%;border-collapse:collapse;">' +
            '<tr>' +
              '<td style="color:#b00;font-weight:bold;width:25%;">' + esc2(today) + '</td>' +
              '<td style="text-align:center;font-weight:bold;font-size:13px;width:50%;">Bill of Lading - Short Form - Not Negotiable</td>' +
              '<td style="text-align:right;width:25%;">Page 1 of 1</td>' +
            '</tr>' +
          '</table>' +
          '<table style="width:100%;border-collapse:collapse;margin-top:4px;">' +
            '<tr>' +
              '<td style="' + hdr + 'width:55%;">Ship From</td>' +
              '<td style="' + hdr + 'width:45%;">Bill of Lading Number:</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="' + cellB + 'height:90px;"><textarea style="' + ta + 'min-height:80px;">' + esc2(shipFrom) + '</textarea></td>' +
              '<td style="' + cellB + 'text-align:center;font-size:22px;font-weight:bold;">' + ti(r.bol_number || "") + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="' + hdr + '">Ship To</td>' +
              '<td style="' + cellB + '">Carrier Name: ' + ti(r.carrier_name || "", "60%") + '<br/>Trailer number: ' + ti("", "55%") + '<br/>Seal number: ' + ti("", "57%") + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="' + cellB + 'height:90px;"><textarea style="' + ta + 'min-height:80px;">' + esc2(shipTo) + '</textarea></td>' +
              '<td style="' + cellB + '">SCAC: ' + ti("", "70%") + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="' + hdr + 'text-align:center;">Third Party Freight Charges Bill to</td>' +
              '<td style="' + cellB + '" rowspan="2"><b>Freight Charge Terms</b> (prepaid unless marked):<br/>Prepaid <b>X</b>&nbsp;&nbsp; Collect ___&nbsp;&nbsp; 3rd Party ___</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="' + cellB + 'height:50px;"><textarea style="' + ta + '">Special Instructions:</textarea></td>' +
            '</tr>' +
          '</table>' +
          '<table style="width:100%;border-collapse:collapse;margin-top:6px;">' +
            '<tr><td style="' + hdr + 'text-align:center;" colspan="4">Customer Order Information</td></tr>' +
            '<tr>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">Customer Order No.</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;"># of Packages</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">Weight</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">Pallet/Slip (Y/N)</td>' +
            '</tr>' +
            [0,1,2].map(() => '<tr>' + '<td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td></tr>').join("") +
          '</table>' +
          '<table style="width:100%;border-collapse:collapse;margin-top:6px;">' +
            '<tr><td style="' + hdr + 'text-align:center;" colspan="6">Carrier Information</td></tr>' +
            '<tr>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">QTY</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">Type</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">Weight</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;width:40%;">Commodity Description</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">NMFC No.</td>' +
              '<td style="' + cellB + 'font-weight:bold;text-align:center;">Class</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="' + cellB + '">' + ti("") + '</td>' +
              '<td style="' + cellB + '">' + ti(r.equipment_type || "") + '</td>' +
              '<td style="' + cellB + '">' + ti("") + '</td>' +
              '<td style="' + cellB + '">' + ti(r.commodity || "") + '</td>' +
              '<td style="' + cellB + '">' + ti("") + '</td>' +
              '<td style="' + cellB + '">' + ti("") + '</td>' +
            '</tr>' +
            [0,1,2,3].map(() => '<tr><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td><td style="' + cellB + '">' + ti("") + '</td></tr>').join("") +
          '</table>' +
          '<table style="width:100%;border-collapse:collapse;margin-top:6px;">' +
            '<tr>' +
              '<td style="' + cellB + 'width:60%;">COD Amount: $ ' + ti("", "40%") + '<br/>Fee terms: Collect ___ Prepaid <b>X</b></td>' +
              '<td style="' + cellB + '">Scheduled pickup: ' + esc2(fmtDT(r.scheduled_at)) + '<br/>Delivery: ' + esc2(fmtDT(r.delivery_at)) + '</td>' +
            '</tr>' +
          '</table>' +
          '<table style="width:100%;border-collapse:collapse;margin-top:6px;">' +
            '<tr>' +
              '<td style="' + cellB + 'width:50%;"><b>Shipper Signature / Date</b><br/><br/>' + ti("", "90%") + '</td>' +
              '<td style="' + cellB + '"><b>Carrier Signature / Pickup Date</b><br/><br/>' + ti("", "90%") + '</td>' +
            '</tr>' +
          '</table>' +
        '</div>'
      );
    })
    .join("");
  const toolbar =
    '<div class="noprint" style="position:sticky;top:0;background:#1e293b;padding:10px 16px;text-align:right;margin-bottom:12px;">' +
    '<span style="color:#fff;float:left;font-family:Arial;font-size:13px;">Edit any field, then print.</span>' +
    '<button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;">Print</button>' +
    '</div>';
  const style = '<style>@media print{.noprint{display:none!important;}input,textarea{border:none!important;}}body{margin:0;background:#f1f5f9;}</style>';
  return '<!doctype html><html><head><title>Bill of Lading</title>' + style + '</head><body>' + toolbar + pages + '</body></html>';
}
