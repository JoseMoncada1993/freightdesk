import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import FileUpload from "@/components/FileUpload";
import { supabase } from "@/lib/supabase";

type CarrierRow = {
  id: number;
  name: string;
  legal_name: string | null;
  dba: string | null;
  entity_type: string | null;
  mc_number: string | null;
  usdot_number: string | null;
  scac: string | null;
  ff_docket: string | null;
  ein: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  cargo_coverage: string | null;
  liability_coverage: string | null;
  coi_expiration: string | null;
  authority_status: string | null;
  operating_status: string | null;
  safety_rating: string | null;
  onboarding_status: string | null;
  onboarding_date: string | null;
  factoring_company: string | null;
  remittance_name: string | null;
  w9_received: boolean;
  coi_received: boolean;
  carrier_packet_received: boolean;
  identity_verified: boolean;
  phone_verified: boolean;
  w9_file_path: string | null;
  coi_file_path: string | null;
  notes: string | null;
};

type CarrierForm = {
  name: string;
  legal_name: string;
  dba: string;
  entity_type: string;
  mc_number: string;
  usdot_number: string;
  scac: string;
  ff_docket: string;
  ein: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  insurance_company: string;
  policy_number: string;
  cargo_coverage: string;
  liability_coverage: string;
  coi_expiration: string;
  authority_status: string;
  operating_status: string;
  safety_rating: string;
  onboarding_status: string;
  onboarding_date: string;
  factoring_company: string;
  remittance_name: string;
  w9_received: boolean;
  coi_received: boolean;
  carrier_packet_received: boolean;
  identity_verified: boolean;
  phone_verified: boolean;
  w9_file_path: string | null;
  coi_file_path: string | null;
  notes: string;
};

const ENTITY_TYPES = ["Carrier", "Broker", "Freight Forwarder", "Owner Operator"];
const ONBOARDING_STATUSES = ["Pending", "In Review", "Approved", "Rejected"];

const EMPTY_FORM: CarrierForm = {
  name: "", legal_name: "", dba: "", entity_type: "Carrier",
  mc_number: "", usdot_number: "", scac: "", ff_docket: "", ein: "",
  contact_name: "", contact_phone: "", contact_email: "",
  address1: "", address2: "", city: "", state: "", zip_code: "", country: "",
  insurance_company: "", policy_number: "", cargo_coverage: "", liability_coverage: "", coi_expiration: "",
  authority_status: "", operating_status: "", safety_rating: "",
  onboarding_status: "Pending", onboarding_date: "",
  factoring_company: "", remittance_name: "",
  w9_received: false, coi_received: false, carrier_packet_received: false,
  identity_verified: false, phone_verified: false,
  w9_file_path: null, coi_file_path: null, notes: "",
};

const SELECT_COLS =
  "id, name, legal_name, dba, entity_type, mc_number, usdot_number, scac, ff_docket, ein, contact_name, contact_phone, contact_email, address1, address2, city, state, zip_code, country, insurance_company, policy_number, cargo_coverage, liability_coverage, coi_expiration, authority_status, operating_status, safety_rating, onboarding_status, onboarding_date, factoring_company, remittance_name, w9_received, coi_received, carrier_packet_received, identity_verified, phone_verified, w9_file_path, coi_file_path, notes";

export default function Carriers() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CarrierForm>(EMPTY_FORM);
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["carriers"],
    queryFn: async (): Promise<CarrierRow[]> => {
      const { data, error } = await supabase
        .from("carriers")
        .select(SELECT_COLS)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CarrierRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: number | null; values: CarrierForm }) => {
      const v = payload.values;
      const record = {
        name: v.name,
        legal_name: v.legal_name || null,
        dba: v.dba || null,
        entity_type: v.entity_type || null,
        mc_number: v.mc_number || null,
        usdot_number: v.usdot_number || null,
        scac: v.scac || null,
        ff_docket: v.ff_docket || null,
        ein: v.ein || null,
        contact_name: v.contact_name || null,
        contact_phone: v.contact_phone || null,
        contact_email: v.contact_email || null,
        address1: v.address1 || null,
        address2: v.address2 || null,
        city: v.city || null,
        state: v.state || null,
        zip_code: v.zip_code || null,
        country: v.country || null,
        insurance_company: v.insurance_company || null,
        policy_number: v.policy_number || null,
        cargo_coverage: v.cargo_coverage || null,
        liability_coverage: v.liability_coverage || null,
        coi_expiration: v.coi_expiration || null,
        authority_status: v.authority_status || null,
        operating_status: v.operating_status || null,
        safety_rating: v.safety_rating || null,
        onboarding_status: v.onboarding_status || null,
        onboarding_date: v.onboarding_date || null,
        factoring_company: v.factoring_company || null,
        remittance_name: v.remittance_name || null,
        w9_received: v.w9_received,
        coi_received: v.coi_received,
        carrier_packet_received: v.carrier_packet_received,
        identity_verified: v.identity_verified,
        phone_verified: v.phone_verified,
        w9_file_path: v.w9_file_path,
        coi_file_path: v.coi_file_path,
        notes: v.notes || null,
      };
      if (payload.id == null) {
        const { error } = await supabase.from("carriers").insert(record);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("carriers").update(record).eq("id", payload.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carriers"] });
      closeModal();
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(row: CarrierRow) {
    setEditingId(row.id);
    setForm({
      name: row.name ?? "",
      legal_name: row.legal_name ?? "",
      dba: row.dba ?? "",
      entity_type: row.entity_type ?? "Carrier",
      mc_number: row.mc_number ?? "",
      usdot_number: row.usdot_number ?? "",
      scac: row.scac ?? "",
      ff_docket: row.ff_docket ?? "",
      ein: row.ein ?? "",
      contact_name: row.contact_name ?? "",
      contact_phone: row.contact_phone ?? "",
      contact_email: row.contact_email ?? "",
      address1: row.address1 ?? "",
      address2: row.address2 ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      zip_code: row.zip_code ?? "",
      country: row.country ?? "",
      insurance_company: row.insurance_company ?? "",
      policy_number: row.policy_number ?? "",
      cargo_coverage: row.cargo_coverage ?? "",
      liability_coverage: row.liability_coverage ?? "",
      coi_expiration: row.coi_expiration ?? "",
      authority_status: row.authority_status ?? "",
      operating_status: row.operating_status ?? "",
      safety_rating: row.safety_rating ?? "",
      onboarding_status: row.onboarding_status ?? "Pending",
      onboarding_date: row.onboarding_date ?? "",
      factoring_company: row.factoring_company ?? "",
      remittance_name: row.remittance_name ?? "",
      w9_received: row.w9_received,
      coi_received: row.coi_received,
      carrier_packet_received: row.carrier_packet_received,
      identity_verified: row.identity_verified,
      phone_verified: row.phone_verified,
      w9_file_path: row.w9_file_path,
      coi_file_path: row.coi_file_path,
      notes: row.notes ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function setField(key: keyof CarrierForm, value: string | boolean | null) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({ id: editingId, values: form });
  }

  const rows = useMemo(() => {
    let list = data ?? [];
    if (entityFilter !== "all") {
      list = list.filter((c) => (c.entity_type ?? "") === entityFilter);
    }
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.legal_name ?? "").toLowerCase().includes(q) ||
        (c.mc_number ?? "").toLowerCase().includes(q) ||
        (c.usdot_number ?? "").toLowerCase().includes(q) ||
        (c.dba ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, entityFilter, search]);

  const inputClass =
    "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const controlClass =
    "rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none";

  function Text(props: { label: string; field: keyof CarrierForm; type?: string }) {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{props.label}</label>
        <input
          type={props.type ?? "text"}
          className={inputClass}
          value={(form[props.field] as string) ?? ""}
          onChange={(e) => setField(props.field, e.target.value)}
        />
      </div>
    );
  }

  function Check(props: { label: string; field: keyof CarrierForm }) {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form[props.field] as boolean}
          onChange={(e) => setField(props.field, e.target.checked)}
        />
        {props.label}
      </label>
    );
  }

  function SectionTitle(props: { children: string }) {
    return (
      <h3 className="mt-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-900">
        {props.children}
      </h3>
    );
  }

  return (
    <div>
      <PageHeader
        title="Carriers"
        subtitle="Carrier & partner onboarding (broker, carrier, freight forwarder, owner-operator)"
        action={
          <button
            type="button"
            onClick={openAdd}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            New Carrier
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Entity type:{" "}
          <select className={controlClass} value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="all">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <input
          type="text"
          placeholder="Search name, MC, USDOT…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={controlClass + " min-w-[220px]"}
        />
      </div>

      <DataTable<CarrierRow>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty={"No carriers yet. Use the New Carrier button to onboard one."}
        columns={[
          { header: "Name", cell: (r) => r.name },
          { header: "Entity", cell: (r) => r.entity_type ?? "—" },
          { header: "MC #", cell: (r) => r.mc_number ?? "—" },
          { header: "USDOT", cell: (r) => r.usdot_number ?? "—" },
          { header: "Onboarding", cell: (r) => r.onboarding_status ?? "—" },
          { header: "COI Exp.", cell: (r) => r.coi_expiration ?? "—" },
          {
            header: "",
            cell: (r) => (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
              </div>
            ),
          },
        ]}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editingId == null ? "New Carrier" : "Edit Carrier"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <SectionTitle>Entity & Identity</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text label="Display Name" field="name" />
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Entity Type</label>
                  <select className={inputClass} value={form.entity_type} onChange={(e) => setField("entity_type", e.target.value)}>
                    {ENTITY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <Text label="Legal Name" field="legal_name" />
                <Text label="DBA" field="dba" />
              </div>

              <SectionTitle>Regulatory IDs</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text label="MC Number" field="mc_number" />
                <Text label="USDOT Number" field="usdot_number" />
                <Text label="SCAC" field="scac" />
                <Text label="FF Docket #" field="ff_docket" />
                <Text label="EIN / Tax ID" field="ein" />
              </div>

              <SectionTitle>Address & Contact</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text label="Contact Name" field="contact_name" />
                <Text label="Contact Phone" field="contact_phone" />
                <Text label="Contact Email" field="contact_email" type="email" />
                <Text label="Address 1" field="address1" />
                <Text label="Address 2" field="address2" />
                <Text label="City" field="city" />
                <Text label="State" field="state" />
                <Text label="Zip Code" field="zip_code" />
                <Text label="Country" field="country" />
              </div>

              <SectionTitle>Insurance</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text label="Insurance Company" field="insurance_company" />
                <Text label="Policy Number" field="policy_number" />
                <Text label="Cargo Coverage" field="cargo_coverage" />
                <Text label="Liability Coverage" field="liability_coverage" />
                <Text label="COI Expiration" field="coi_expiration" type="date" />
              </div>

              <SectionTitle>Authority & Safety</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text label="Authority Status" field="authority_status" />
                <Text label="Operating Status" field="operating_status" />
                <Text label="Safety Rating" field="safety_rating" />
              </div>

              <SectionTitle>Compliance Documents</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FileUpload
                  label="W-9 Document"
                  prefix="w9"
                  value={form.w9_file_path}
                  onUploaded={(path) => { setField("w9_file_path", path); setField("w9_received", true); }}
                />
                <FileUpload
                  label="Certificate of Insurance (COI)"
                  prefix="coi"
                  value={form.coi_file_path}
                  onUploaded={(path) => { setField("coi_file_path", path); setField("coi_received", true); }}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <Check label="W-9 received" field="w9_received" />
                <Check label="COI received" field="coi_received" />
                <Check label="Carrier packet received" field="carrier_packet_received" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Onboarding Status</label>
                  <select className={inputClass} value={form.onboarding_status} onChange={(e) => setField("onboarding_status", e.target.value)}>
                    {ONBOARDING_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <Text label="Onboarding Date" field="onboarding_date" type="date" />
              </div>

              <SectionTitle>Fraud Controls</SectionTitle>
              <div className="flex flex-wrap gap-4">
                <Check label="Identity verified" field="identity_verified" />
                <Check label="Phone verified" field="phone_verified" />
              </div>

              <SectionTitle>Banking / Remittance</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Text label="Factoring Company" field="factoring_company" />
                <Text label="Remittance Name" field="remittance_name" />
              </div>

              <SectionTitle>Notes</SectionTitle>
              <textarea
                className={inputClass}
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />

              {saveMutation.isError && (
                <p className="text-sm text-red-600">Could not save. Please try again.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
