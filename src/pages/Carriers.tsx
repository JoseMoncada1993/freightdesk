import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import ImportCsvModal from "@/components/ImportCsvModal";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import { useCarriers } from "@/hooks/useTables";
import { useAddCarrier, useUpdateCarrier } from "@/hooks/useMutations";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { Carrier } from "@/lib/types";

const MODES = ["truckload", "ltl", "intermodal", "parcel", "freight_forwarder", "customs_broker"];

function complianceOk(c: Carrier) {
  return c.w9_received && c.coi_received && c.carrier_packet_received;
}

function coiExpiring(c: Carrier) {
  if (!c.coi_expiration) return false;
  const days = (new Date(c.coi_expiration).getTime() - Date.now()) / 864e5;
  return days < 30;
}

function CarrierForm({ carrier, onClose }: { carrier: Carrier | null; onClose: () => void }) {
  const add = useAddCarrier();
  const update = useUpdateCarrier();
  const editing = carrier != null;

  const [name, setName] = useState(carrier?.name ?? "");
  const [scac, setScac] = useState(carrier?.scac ?? "");
  const [mode, setMode] = useState(carrier?.mode ?? "truckload");
  const [mcNumber, setMcNumber] = useState(carrier?.mc_number ?? "");
  const [dotNumber, setDotNumber] = useState(carrier?.usdot_number ?? "");
  const [contactName, setContactName] = useState(carrier?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(carrier?.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(carrier?.contact_email ?? "");
  const [insuranceCompany, setInsuranceCompany] = useState(carrier?.insurance_company ?? "");
  const [coiExpiration, setCoiExpiration] = useState(carrier?.coi_expiration ?? "");
  const [w9, setW9] = useState(carrier?.w9_received ?? false);
  const [coi, setCoi] = useState(carrier?.coi_received ?? false);
  const [packet, setPacket] = useState(carrier?.carrier_packet_received ?? false);
  const [notes, setNotes] = useState(carrier?.notes ?? "");

  const pending = add.isPending || update.isPending;
  const canSubmit = name.trim() !== "" && !pending;

  const handleSubmit = () => {
    const payload = {
      name: name.trim(),
      scac: scac.trim() || null,
      mode,
      mc_number: mcNumber.trim() || null,
      usdot_number: dotNumber.trim() || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      insurance_company: insuranceCompany.trim() || null,
      coi_expiration: coiExpiration || null,
      w9_received: w9,
      coi_received: coi,
      carrier_packet_received: packet,
      notes: notes.trim() || null,
    };
    if (editing) {
      update.mutate({ id: carrier.id, ...payload }, { onSuccess: onClose });
    } else {
      add.mutate(payload, { onSuccess: onClose });
    }
  };

  const checkbox = (label: string, checked: boolean, set: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="rounded border-slate-300" />
      {label}
    </label>
  );

  return (
    <Modal
      title={editing ? `Edit ${carrier.name}` : "Add carrier"}
      onClose={onClose}
      wide
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save changes" : "Add carrier"}
          pending={pending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="SCAC">
          <input value={scac} onChange={(e) => setScac(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
            {MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="MC #">
          <input value={mcNumber} onChange={(e) => setMcNumber(e.target.value)} className={inputCls} />
        </Field>
        <Field label="USDOT #">
          <input value={dotNumber} onChange={(e) => setDotNumber(e.target.value)} className={inputCls} />
        </Field>
        <Field label="COI expiration">
          <input value={coiExpiration} onChange={(e) => setCoiExpiration(e.target.value)} type="date" className={inputCls} />
        </Field>
        <Field label="Contact name">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Contact phone">
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Contact email">
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" className={inputCls} />
        </Field>
      </div>
      <Field label="Insurance company">
        <input value={insuranceCompany} onChange={(e) => setInsuranceCompany(e.target.value)} className={inputCls} />
      </Field>
      <div className="flex gap-6">
        {checkbox("W-9 received", w9, setW9)}
        {checkbox("COI received", coi, setCoi)}
        {checkbox("Carrier packet", packet, setPacket)}
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <ErrorText error={add.error ?? update.error} />
    </Modal>
  );
}

export default function Carriers() {
  const { data, isLoading, error } = useCarriers();
  const update = useUpdateCarrier();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);

  return (
    <div>
      <PageHeader
        title="Carriers"
        subtitle="Freight providers — authority, insurance and onboarding compliance"
        action={
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportCsv(
                  (data ?? []).map((c) => ({
                    name: c.name, scac: c.scac, mode: c.mode, mc_number: c.mc_number,
                    usdot_number: c.usdot_number, contact: c.contact_name, phone: c.contact_phone,
                    email: c.contact_email, insurance: c.insurance_company, coi_expiration: c.coi_expiration,
                    w9: c.w9_received, coi: c.coi_received, packet: c.carrier_packet_received, active: c.active,
                  })),
                  "carriers",
                )
              }
              {...exportButtonProps(data?.length ?? 0)}
            >
              Export CSV
            </button>
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
              + Add carrier
            </button>
          </div>
        }
      />
      <DataTable<Carrier>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        columns={[
          { header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "SCAC", cell: (r) => r.scac ?? "—" },
          { header: "Mode", cell: (r) => r.mode },
          { header: "MC #", cell: (r) => r.mc_number ?? "—" },
          { header: "USDOT #", cell: (r) => r.usdot_number ?? "—" },
          { header: "Contact", cell: (r) => r.contact_name ?? r.contact_phone ?? "—" },
          {
            header: "COI expires",
            cell: (r) =>
              r.coi_expiration ? (
                <span className={coiExpiring(r) ? "text-red-600 font-medium" : ""}>
                  {new Date(r.coi_expiration).toLocaleDateString()}
                </span>
              ) : (
                "—"
              ),
          },
          {
            header: "Compliance",
            cell: (r) =>
              complianceOk(r) ? (
                <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-medium">Complete</span>
              ) : (
                <span className="inline-block rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-medium">
                  Missing docs
                </span>
              ),
          },
          {
            header: "Active",
            cell: (r) => (
              <button
                onClick={() => update.mutate({ id: r.id, active: !r.active })}
                className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                title="Click to toggle"
              >
                {r.active ? "Active" : "Inactive"}
              </button>
            ),
          },
          {
            header: "",
            cell: (r) => (
              <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline text-xs font-medium">
                Edit
              </button>
            ),
          },
        ]}
      />
      {showAdd && <CarrierForm carrier={null} onClose={() => setShowAdd(false)} />}
      {editing && <CarrierForm carrier={editing} onClose={() => setEditing(null)} />}
      {showImport && (
        <ImportCsvModal
          title="Import carriers from CSV"
          fields={[
            { key: "name", aliases: ["name"], required: true },
            { key: "scac", aliases: ["scac"] },
            { key: "mode", aliases: ["mode"] },
            { key: "mc_number", aliases: ["mc_number", "mc"] },
            { key: "usdot_number", aliases: ["usdot_number", "usdot", "dot"] },
            { key: "contact", aliases: ["contact", "contact_name"] },
            { key: "phone", aliases: ["phone", "contact_phone"] },
            { key: "email", aliases: ["email", "contact_email"] },
            { key: "insurance", aliases: ["insurance", "insurance_company"] },
            { key: "coi_expiration", aliases: ["coi_expiration", "coi_expiry"] },
          ]}
          exampleHeader="name, scac, mode, mc_number, usdot_number, contact, phone, email, insurance, coi_expiration"
          toPayload={(r) => ({
            name: r.name,
            scac: r.scac || null,
            mode: MODES.includes(r.mode?.toLowerCase()) ? r.mode.toLowerCase() : "truckload",
            mc_number: r.mc_number || null,
            usdot_number: r.usdot_number || null,
            contact_name: r.contact || null,
            contact_phone: r.phone || null,
            contact_email: r.email || null,
            insurance_company: r.insurance || null,
            coi_expiration: r.coi_expiration || null,
          })}
          onImport={async (rows) => {
            const { error: e } = await supabase.from("carriers").insert(rows as never);
            if (e) throw e;
            qc.invalidateQueries({ queryKey: ["carriers"] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
