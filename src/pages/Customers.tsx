import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { supabase } from "@/lib/supabase";

type CustomerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_phone: string | null;
  business_hours: string | null;
  facility_type: string | null;
  special_instructions: string | null;
  contact_email: string | null;
};

type FormState = {
  first_name: string;
  last_name: string;
  company_name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  contact_phone: string;
  business_hours: string;
  facility_type: string;
  special_instructions: string;
  contact_email: string;
};

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  company_name: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip_code: "",
  contact_phone: "",
  business_hours: "",
  facility_type: "",
  special_instructions: "",
  contact_email: "",
};

const FIELDS: { key: keyof FormState; label: string; type?: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "company_name", label: "Company Name" },
  { key: "address1", label: "Address 1" },
  { key: "address2", label: "Address 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip_code", label: "Zip Code" },
  { key: "contact_phone", label: "Phone Number" },
  { key: "business_hours", label: "Business Hours" },
  { key: "facility_type", label: "Type of Facility" },
  { key: "special_instructions", label: "Special Instructions", type: "textarea" },
  { key: "contact_email", label: "Email", type: "email" },
];

function rowToForm(row: CustomerRow): FormState {
  return {
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    company_name: row.company_name ?? "",
    address1: row.address1 ?? "",
    address2: row.address2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip_code: row.zip_code ?? "",
    contact_phone: row.contact_phone ?? "",
    business_hours: row.business_hours ?? "",
    facility_type: row.facility_type ?? "",
    special_instructions: row.special_instructions ?? "",
    contact_email: row.contact_email ?? "",
  };
}

export default function Customers() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomerRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: FormState) => {
      const record = {
        ...payload,
        name:
          [payload.first_name, payload.last_name].filter(Boolean).join(" ") ||
          payload.company_name ||
          "",
      };
      if (editingId) {
        const { error } = await supabase
          .from("customers")
          .update(record)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(row: CustomerRow) {
    setEditingId(row.id);
    setForm(rowToForm(row));
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    save.reset();
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer records and contacts"
        action={
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            New Customer
          </button>
        }
      />

      <DataTable<CustomerRow>
        rows={data}
        isLoading={isLoading}
        error={error as Error | null}
        rowKey={(r) => r.id}
        empty={"No customers yet. Use the New Customer button to add one."}
        columns={[
          {
            header: "Name",
            cell: (r) =>
              [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          },
          { header: "Company", cell: (r) => r.company_name ?? "—" },
          { header: "City", cell: (r) => r.city ?? "—" },
          { header: "State", cell: (r) => r.state ?? "—" },
          { header: "Phone", cell: (r) => r.contact_phone ?? "—" },
          { header: "Email", cell: (r) => r.contact_email ?? "—" },
          {
            header: "",
            cell: (r) => (
              <button
                onClick={() => openEdit(r)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit
              </button>
            ),
          },
        ]}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Customer" : "New Customer"}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
              className="px-6 py-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <div
                    key={f.key}
                    className={
                      f.type === "textarea" ? "sm:col-span-2" : undefined
                    }
                  >
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {f.label}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        value={form[f.key]}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                        rows={3}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type={f.type ?? "text"}
                        value={form[f.key]}
                        onChange={(e) =>
                          setForm({ ...form, [f.key]: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              {save.isError && (
                <p className="text-red-600 text-sm mt-4">
                  {(save.error as Error)?.message ?? "Failed to save customer."}
                </p>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60"
                >
                  {save.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
