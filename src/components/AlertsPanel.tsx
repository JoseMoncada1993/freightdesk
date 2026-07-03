// "Needs attention" alert center: surfaces operational risks across modules.
// Pure client-side — computed from data the dashboard already loads.
import { Link } from "react-router-dom";
import { useLoads } from "@/hooks/useLoads";
import { useCarriers, useTasks } from "@/hooks/useTables";
import { useInventoryLevels } from "@/hooks/useInventory";
import { useYardTrailers } from "@/hooks/useYard";

interface Alert {
  severity: "red" | "amber";
  message: string;
  to: string;
  linkLabel: string;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function AlertsPanel() {
  const loads = useLoads();
  const carriers = useCarriers();
  const tasks = useTasks();
  const inventory = useInventoryLevels();
  const yard = useYardTrailers();

  const alerts: Alert[] = [];
  const now = Date.now();

  // COI expired / expiring within 30 days (active carriers)
  for (const c of carriers.data ?? []) {
    if (!c.active || !c.coi_expiration) continue;
    const days = Math.floor((new Date(c.coi_expiration).getTime() - now) / 864e5);
    if (days < 0) {
      alerts.push({ severity: "red", message: `${c.name}: insurance (COI) EXPIRED ${-days} days ago — do not tender freight`, to: "/carriers", linkLabel: "Carriers" });
    } else if (days <= 30) {
      alerts.push({ severity: "amber", message: `${c.name}: insurance (COI) expires in ${days} days — request renewal`, to: "/carriers", linkLabel: "Carriers" });
    }
  }

  // Overdue invoices
  for (const l of loads.data ?? []) {
    if (l.invoiced_at && !l.paid_at && l.invoice_due_date && new Date(l.invoice_due_date + "T23:59:59").getTime() < now) {
      const days = Math.floor((now - new Date(l.invoice_due_date).getTime()) / 864e5);
      alerts.push({
        severity: days > 30 ? "red" : "amber",
        message: `Invoice ${l.invoice_number ?? l.ref} (${l.customer_name ?? "customer"}) is ${days}d past due — ${money(l.rate_usd ?? 0)}`,
        to: "/billing",
        linkLabel: "Billing",
      });
    }
  }

  // Trailers dwelling 48h+
  for (const t of yard.data ?? []) {
    if (t.gate_out_at || t.archived || !t.gate_in_at) continue;
    const hours = Math.floor((now - new Date(t.gate_in_at).getTime()) / 36e5);
    if (hours > 48) {
      alerts.push({
        severity: hours > 96 ? "red" : "amber",
        message: `Trailer ${t.trailer_no} at ${t.site} has been in the yard ${Math.floor(hours / 24)}d — bill detention or turn it`,
        to: "/trailers",
        linkLabel: "Drop Trailers",
      });
    }
  }

  // Low stock
  for (const r of inventory.data ?? []) {
    if (r.low_stock) {
      alerts.push({
        severity: "amber",
        message: `${r.sku} at ${r.warehouse_code}: ${r.qty_on_hand} on hand (reorder point ${r.reorder_point})`,
        to: "/inventory",
        linkLabel: "Inventory",
      });
    }
  }

  // Overdue tasks
  for (const t of tasks.data ?? []) {
    if (t.archived || t.status === "done" || !t.due_date) continue;
    if (new Date(t.due_date + "T23:59:59").getTime() < now) {
      alerts.push({ severity: "amber", message: `Task overdue: ${t.title}${t.assignee ? ` (${t.assignee})` : ""}`, to: "/tasks", linkLabel: "Tasks" });
    }
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1));

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-sm text-slate-600">All clear — no expiring insurance, overdue invoices, aging trailers, low stock, or overdue tasks.</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-sm">
          Needs attention
          <span className="ml-2 inline-block rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">{alerts.length}</span>
        </h2>
      </div>
      <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
        {alerts.map((a, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${a.severity === "red" ? "bg-red-500" : "bg-amber-400"}`} />
            <span className="flex-1 text-slate-700">{a.message}</span>
            <Link to={a.to} className="text-blue-600 hover:underline text-xs font-medium whitespace-nowrap">
              {a.linkLabel} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
