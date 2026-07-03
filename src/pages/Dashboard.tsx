import PageHeader from "@/components/PageHeader";
import AlertsPanel from "@/components/AlertsPanel";
import DieselWidget from "@/components/DieselWidget";
import StatCard from "@/components/ui/StatCard";
import { useLoads } from "@/hooks/useLoads";
import { useCustomers, useTasks } from "@/hooks/useTables";
import { useYardTrailers } from "@/hooks/useYard";
import { useInventoryLevels } from "@/hooks/useInventory";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Dashboard() {
  const loads = useLoads();
  const customers = useCustomers();
  const tasks = useTasks();
  const yard = useYardTrailers();
  const inventory = useInventoryLevels();

  const all = loads.data ?? [];
  const active = all.filter((l) => l.status && !["delivered", "cancelled"].includes(l.status)).length;
  const delivered = all.filter((l) => l.on_time != null);
  const onTime = delivered.length
    ? Math.round((delivered.filter((l) => l.on_time).length / delivered.length) * 100)
    : 0;
  const revenue = all
    .filter((l) => l.status !== "cancelled")
    .reduce((s, l) => s + (l.rate_usd ?? 0), 0);
  const totalMargin = all
    .filter((l) => l.status !== "cancelled")
    .reduce((s, l) => s + (l.margin_usd ?? 0), 0);
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done" && !t.archived).length;
  const trailersInYard = (yard.data ?? []).filter((t) => !t.gate_out_at).length;
  const lowStock = (inventory.data ?? []).filter((r) => r.low_stock).length;

  // load volume by month from pickup_at
  const byMonth = new Map<string, number>();
  for (const l of all) {
    if (!l.pickup_at) continue;
    const d = new Date(l.pickup_at);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const volume = Array.from(byMonth, ([month, count]) => ({ month, loads: count }));

  // revenue by carrier (top 6)
  const byCarrier = new Map<string, number>();
  for (const l of all) {
    if (!l.rate_usd || l.status === "cancelled") continue;
    const key = l.carrier_name ?? "Unassigned";
    byCarrier.set(key, (byCarrier.get(key) ?? 0) + l.rate_usd);
  }
  const carrierRevenue = Array.from(byCarrier, ([carrier, rev]) => ({ carrier, revenue: Math.round(rev) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live operational overview" />
      <AlertsPanel />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Active Shipments" value={loads.isLoading ? "…" : active} hint="not delivered/cancelled" />
        <StatCard label="On-Time %" value={loads.isLoading ? "…" : `${onTime}%`} hint="of delivered loads" />
        <StatCard label="Booked Revenue" value={loads.isLoading ? "…" : money(revenue)} hint="all non-cancelled loads" />
        <StatCard label="Booked Margin" value={loads.isLoading ? "…" : money(totalMargin)} hint="rate minus carrier pay" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Trailers in Yard" value={yard.isLoading ? "…" : trailersInYard} hint="drop trailer pool" />
        <StatCard label="Low Stock Lines" value={inventory.isLoading ? "…" : lowStock} hint="at/below reorder point" />
        <StatCard label="Open Tasks" value={tasks.isLoading ? "…" : openTasks} />
        <StatCard label="Customers" value={customers.isLoading ? "…" : (customers.data?.length ?? 0)} />
      </div>
      <div className="mb-6">
        <DieselWidget />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold mb-4">Load volume by pickup month</h2>
          <div style={{ height: 280 }}>
            {volume.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {loads.isLoading ? "Loading..." : "No dated loads yet."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume}>
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="loads" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold mb-4">Booked revenue by carrier</h2>
          <div style={{ height: 280 }}>
            {carrierRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {loads.isLoading ? "Loading..." : "No rated loads yet."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierRevenue} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="carrier" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
