import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { useLoads } from "@/hooks/useLoads";
import type { LoadEnriched } from "@/lib/types";

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Shipments() {
  const { data, isLoading, error } = useLoads();
  return (
    <div>
      <PageHeader title="Shipments" subtitle="Loads joined to carriers and lanes (loads_enriched)" />
      <DataTable<LoadEnriched>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id ?? r.ref ?? Math.random()}
        empty="No loads found."
        columns={[
          { header: "Ref", cell: (r) => r.ref ?? "—" },
          { header: "Lane", cell: (r) => r.lane ?? `${r.origin ?? "?"} → ${r.destination ?? "?"}` },
          { header: "Carrier", cell: (r) => r.carrier_name ?? "—" },
          { header: "Status", cell: (r) => r.status ?? "—" },
          { header: "Rate", cell: (r) => money(r.rate_usd) },
          { header: "On time", cell: (r) => (r.on_time == null ? "—" : r.on_time ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
