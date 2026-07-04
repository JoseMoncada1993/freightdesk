import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/AuthContext";
import DataTable from "@/components/DataTable";
import ImportCsvModal from "@/components/ImportCsvModal";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabase";
import {
  useAddCustomerAddress,
  useCustomerAddresses,
  useCustomers,
  useDeleteCustomerAddress,
  useUpdateCustomerAddress,
} from "@/hooks/useTables";
import type { CustomerAddress } from "@/lib/types";
import { useAddCustomer, useUpdateCustomer } from "@/hooks/useMutations";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { Customer } from "@/lib/types";

function AddressBook({ customerId }: { customerId: number }) {
  const addresses = useCustomerAddresses();
  const addAddr = useAddCustomerAddress();
  const updateAddr = useUpdateCustomerAddress();
  const delAddr = useDeleteCustomerAddress();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [hours, setHours] = useState("");
  const [instructions, setInstructions] = useState("");

  const list = (addresses.data ?? []).filter((a) => a.customer_id === customerId);
  const pending = addAddr.isPending || updateAddr.isPending;
  const canSave = label.trim() !== "" && !pending;

  const openForm = (a: CustomerAddress | null) => {
    setEditingId(a?.id ?? null);
    setLabel(a?.label ?? "");
    setAddress1(a?.address1 ?? "");
    setCity(a?.city ?? "");
    setState(a?.state ?? "");
    setZip(a?.zip_code ?? "");
    setContact(a?.contact_name ?? "");
    setPhone(a?.contact_phone ?? "");
    setFacilityType(a?.facility_type ?? "");
    setHours(a?.business_hours ?? "");
    setInstructions(a?.special_instructions ?? "");
    setFormOpen(true);
  };

  const handleSave = () => {
    const payload = {
      label: label.trim(),
      address1: address1.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip_code: zip.trim() || null,
      contact_name: contact.trim() || null,
      contact_phone: phone.trim() || null,
      facility_type: facilityType.trim() || null,
      business_hours: hours.trim() || null,
      special_instructions: instructions.trim() || null,
    };
    const opts = { onSuccess: () => setFormOpen(false) };
    if (editingId != null) {
      updateAddr.mutate({ id: editingId, ...payload }, opts);
    } else {
      addAddr.mutate({ customer_id: customerId, ...payload }, opts);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Additional addresses ({list.length})</p>
        {!formOpen && (
          <button type="button" onClick={() => openForm(null)} className="text-blue-600 hover:underline text-xs font-medium">
            + Add address
          </button>
        )}
      </div>
      {list.map((a) => (
        <div key={a.id} className="rounded-md bg-white border border-slate-200 px-3 py-2 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-medium">{a.label}</span>
              <span className="text-slate-500">
                {" — "}
                {[a.address1, [a.city, a.state].filter(Boolean).join(", "), a.zip_code].filter(Boolean).join(", ") || "no address"}
                {a.contact_name ? ` · ${a.contact_name}` : ""}
              </span>
              {(a.facility_type || a.business_hours || a.special_instructions) && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {[a.facility_type, a.business_hours, a.special_instructions].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <div className="flex gap-2 ml-3 whitespace-nowrap">
              <button type="button" onClick={() => openForm(a)} className="text-blue-600 hover:underline text-xs font-medium">
                Edit
              </button>
              <button type="button" onClick={() => delAddr.mutate(a.id)} className="text-slate-400 hover:text-red-600 text-xs font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
      {list.length === 0 && !formOpen && (
        <p className="text-xs text-slate-400">No extra addresses yet — the main address above is used by default.</p>
      )}
      {formOpen && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label * (e.g. Dallas DC, Dock 7)">
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Address">
              <input value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Field label="City">
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="State">
              <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
            </Field>
            <Field label="ZIP">
              <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Contact">
              <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Facility type">
              <input value={facilityType} onChange={(e) => setFacilityType(e.target.value)} placeholder="Warehouse, DC, retail…" className={inputCls} />
            </Field>
            <Field label="Business hours">
              <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="M-F 8am-5pm" className={inputCls} />
            </Field>
          </div>
          <Field label="Special instructions">
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className={inputCls} />
          </Field>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : editingId != null ? "Save changes" : "Save address"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
          <ErrorText error={addAddr.error ?? updateAddr.error} />
        </div>
      )}
    </div>
  );
}

function CustomerForm({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const add = useAddCustomer();
  const update = useUpdateCustomer();
  const editing = customer != null;

  const [name, setName] = useState(customer?.name ?? "");
  const [companyName, setCompanyName] = useState(customer?.company_name ?? "");
  const [email, setEmail] = useState(customer?.contact_email ?? "");
  const [phone, setPhone] = useState(customer?.contact_phone ?? "");
  const [address1, setAddress1] = useState(customer?.address1 ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [state, setState] = useState(customer?.state ?? "");
  const [zip, setZip] = useState(customer?.zip_code ?? "");
  const [facilityType, setFacilityType] = useState(customer?.facility_type ?? "");
  const [hours, setHours] = useState(customer?.business_hours ?? "");
  const [instructions, setInstructions] = useState(customer?.special_instructions ?? "");

  const pending = add.isPending || update.isPending;
  const canSubmit = name.trim() !== "" && !pending;

  const handleSubmit = () => {
    const payload = {
      name: name.trim(),
      company_name: companyName.trim() || null,
      contact_email: email.trim() || null,
      contact_phone: phone.trim() || null,
      address1: address1.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip_code: zip.trim() || null,
      facility_type: facilityType.trim() || null,
      business_hours: hours.trim() || null,
      special_instructions: instructions.trim() || null,
    };
    if (editing) {
      update.mutate({ id: customer.id, ...payload }, { onSuccess: onClose });
    } else {
      add.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${customer.name ?? "customer"}` : "Add customer"}
      onClose={onClose}
      wide
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save changes" : "Add customer"}
          pending={pending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Company">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Address">
        <input value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
        </Field>
        <Field label="State">
          <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ZIP">
          <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Facility type">
          <input value={facilityType} onChange={(e) => setFacilityType(e.target.value)} placeholder="Warehouse, DC, retail…" className={inputCls} />
        </Field>
        <Field label="Business hours">
          <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="M-F 8am-5pm" className={inputCls} />
        </Field>
      </div>
      <Field label="Special instructions">
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className={inputCls} />
      </Field>
      {editing ? (
        <AddressBook customerId={customer.id} />
      ) : (
        <p className="text-xs text-slate-400">
          Tip: save the customer first, then reopen with Edit to add more addresses (docks, DCs, billing).
        </p>
      )}
      <ErrorText error={add.error ?? update.error} />
    </Modal>
  );
}

export default function Customers() {
  const { data, isLoading, error } = useCustomers();
  const update = useUpdateCustomer();
  const { can } = useAuth();
  const canWrite = can("customers");
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const states = useMemo(
    () => Array.from(new Set((data ?? []).map((c) => c.state).filter(Boolean))).sort() as string[],
    [data],
  );

  const rows = useMemo(() => {
    let out = data ?? [];
    if (stateFilter !== "all") out = out.filter((c) => c.state === stateFilter);
    if (activeFilter !== "all") out = out.filter((c) => (activeFilter === "active" ? c.active : !c.active));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((c) =>
        [c.name, c.company_name, c.contact_email, c.contact_phone, c.city, c.state, c.facility_type]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return out;
  }, [data, search, stateFilter, activeFilter]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer records, facilities and contacts"
        action={
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportCsv(
                  rows.map((c) => ({
                    name: c.name, company: c.company_name, email: c.contact_email, phone: c.contact_phone,
                    address: c.address1, city: c.city, state: c.state, zip: c.zip_code,
                    facility_type: c.facility_type, business_hours: c.business_hours,
                    special_instructions: c.special_instructions, active: c.active,
                  })),
                  "customers",
                )
              }
              {...exportButtonProps(rows.length)}
            >
              Export CSV
            </button>
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
                + Add customer
              </button>
            )}
          </div>
        }
      />
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, email, city…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">Active + inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <span className="text-xs text-slate-400">{rows.length} customers</span>
      </div>
      <DataTable<Customer>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty="No customers match this filter."
        columns={[
          { header: "Name", cell: (r) => <span className="font-medium">{r.name ?? "—"}</span>, sort: (r) => r.name },
          { header: "Company", cell: (r) => r.company_name ?? "—", sort: (r) => r.company_name },
          { header: "Email", cell: (r) => r.contact_email ?? "—", sort: (r) => r.contact_email },
          { header: "Phone", cell: (r) => r.contact_phone ?? "—" },
          {
            header: "Location",
            cell: (r) => [r.city, r.state].filter(Boolean).join(", ") || "—",
            sort: (r) => [r.state, r.city].filter(Boolean).join(", "),
          },
          { header: "Facility", cell: (r) => r.facility_type ?? "—", sort: (r) => r.facility_type },
          {
            header: "Active",
            cell: (r) =>
              canWrite ? (
                <button
                  onClick={() => update.mutate({ id: r.id, active: !r.active })}
                  className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                  title="Click to toggle"
                >
                  {r.active ? "Active" : "Inactive"}
                </button>
              ) : (
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                >
                  {r.active ? "Active" : "Inactive"}
                </span>
              ),
            sort: (r) => (r.active ? 1 : 0),
          },
          {
            header: "",
            cell: (r) =>
              canWrite ? (
                <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline text-xs font-medium">
                  Edit
                </button>
              ) : null,
          },
        ]}
      />
      {showAdd && <CustomerForm customer={null} onClose={() => setShowAdd(false)} />}
      {editing && <CustomerForm customer={editing} onClose={() => setEditing(null)} />}
      {showImport && (
        <ImportCsvModal
          title="Import customers from CSV"
          fields={[
            { key: "name", aliases: ["name"], required: true },
            { key: "company", aliases: ["company", "company_name"] },
            { key: "email", aliases: ["email", "contact_email"] },
            { key: "phone", aliases: ["phone", "contact_phone"] },
            { key: "address", aliases: ["address", "address1"] },
            { key: "city", aliases: ["city"] },
            { key: "state", aliases: ["state"] },
            { key: "zip", aliases: ["zip", "zip_code", "zipcode"] },
            { key: "facility_type", aliases: ["facility_type", "facility"] },
            { key: "business_hours", aliases: ["business_hours", "hours"] },
            { key: "special_instructions", aliases: ["special_instructions", "instructions"] },
          ]}
          exampleHeader="name, company, email, phone, address, city, state, zip, facility_type, business_hours, special_instructions"
          toPayload={(r) => ({
            name: r.name,
            company_name: r.company || null,
            contact_email: r.email || null,
            contact_phone: r.phone || null,
            address1: r.address || null,
            city: r.city || null,
            state: r.state || null,
            zip_code: r.zip || null,
            facility_type: r.facility_type || null,
            business_hours: r.business_hours || null,
            special_instructions: r.special_instructions || null,
          })}
          onImport={async (rows) => {
            const { error: e } = await supabase.from("customers").insert(rows as never);
            if (e) throw e;
            qc.invalidateQueries({ queryKey: ["customers"] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
