import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { useCarriers } from "@/hooks/useTables";
import type { Carrier } from "@/lib/types";

export default function Carriers() {
  const { data, isLoading, error } = useCarriers();
  return (
    <div>
      <PageHeader title="Carriers" subtitle="Carrier records, SCAC and mode" />
      <DataTable<Carrier>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        columns={[
          { header: "Name", cell: (r) => r.name },
          { header: "SCAC", cell: (r) => r.scac ?? "—" },
          { header: "Mode", cell: (r) => r.mode },
          { header: "Active", cell: (r) => (r.active ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
