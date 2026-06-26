import PageHeader from "@/components/PageHeader";
import DieselWidget from "@/components/DieselWidget";
import StatCard from "@/components/ui/StatCard";
import { useLoads } from "@/hooks/useLoads";
import { useCustomers, useTasks } from "@/hooks/useTables";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const loads = useLoads();
  const customers = useCustomers();
  const tasks = useTasks();

  const all = loads.data ?? [];
  const active = all.filter((l) => l.status && !["delivered", "cancelled"].includes(l.status)).length;
  const delivered = all.filter((l) => l.on_time != null);
  const onTime = delivered.length
    ? Math.round((delivered.filter((l) => l.on_time).length / delivered.length) * 100)
    : 0;
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done").length;

  // load volume by month from pickup_at
  const byMonth = new Map<string, number>();
  for (const l of all) {
    if (!l.pickup_at) continue;
    const d = new Date(l.pickup_at);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const volume = Array.from(byMonth, ([month, count]) => ({ month, loads: count }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live operational overview" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Shipments" value={loads.isLoading ? "…" : active} hint="not delivered/cancelled" />
        <StatCard label="On-Time %" value={loads.isLoading ? "…" : `${onTime}%`} hint="of delivered loads" />
        <StatCard label="Open Tasks" value={tasks.isLoading ? "…" : openTasks} />
        <StatCard label="Customers" value={customers.isLoading ? "…" : (customers.data?.length ?? 0)} />
      </div>
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

      <div className="mt-8">
        <DieselWidget />
      </div>
    </div>
  );
}
