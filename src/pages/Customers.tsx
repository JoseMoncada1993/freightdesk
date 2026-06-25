import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { useCustomers } from "@/hooks/useTables";
import type { Customer } from "@/lib/types";

export default function Customers() {
  const { data, isLoading, error } = useCustomers();
  return (
    <div>
      <PageHeader title="Customers" subtitle="Customer records and contacts" />
      <DataTable<Customer>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        columns={[
          { header: "Name", cell: (r) => r.name },
          { header: "Email", cell: (r) => r.contact_email ?? "—" },
          { header: "Phone", cell: (r) => r.contact_phone ?? "—" },
          { header: "Active", cell: (r) => (r.active ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
