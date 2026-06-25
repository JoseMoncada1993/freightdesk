import PageHeader from "@/components/PageHeader";
import { useLoads } from "@/hooks/useLoads";

const fmtUsd = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function Shipments() {
  const { data, isLoading, error } = useLoads();

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle="Track loads, carriers, lanes and status"
        action={
          <button className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-md">
            New
          </button>
        }
      />

      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">
          Loading shipments…
        </div>
      )}

      {error && (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-600 shadow-sm">
          Failed to load shipments: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {data && !isLoading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {data.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No shipments yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Carrier</th>
                  <th className="px-4 py-3 font-medium">Lane</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Pickup</th>
                  <th className="px-4 py-3 font-medium">ETA</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.ref}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.carrier_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.lane ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtUsd(row.rate_usd)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(row.pickup_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(row.eta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
