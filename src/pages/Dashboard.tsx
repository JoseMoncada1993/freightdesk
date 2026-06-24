import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/ui/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const demoVolume = [
  { month: "Jan", loads: 42 },
  { month: "Feb", loads: 55 },
  { month: "Mar", loads: 61 },
  { month: "Apr", loads: 48 },
  { month: "May", loads: 70 },
  { month: "Jun", loads: 66 },
];

export default function Dashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Operational overview & analytics" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Shipments" value={24} hint="in transit" />
        <StatCard label="On-Time %" value="94%" hint="trailing 30 days" />
        <StatCard label="Open Tasks" value={7} />
        <StatCard label="Customers" value={18} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold mb-4">Monthly Load Volume</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demoVolume}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="loads" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
