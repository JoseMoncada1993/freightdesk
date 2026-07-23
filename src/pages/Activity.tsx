// Activity Log (admin only): every add / edit / delete across the app,
// captured automatically by database triggers (0027). Answers "who did what,
// where, and when" — filter by teammate, module, or action.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { supabase } from "@/lib/supabase";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { Database } from "@/lib/database.types";

type ActivityRow = Database["public"]["Tables"]["activity_log"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const TABLE_LABELS: Record<string, string> = {
  loads: "Shipments",
  skus: "SKU Generator",
  sku_conventions: "SKU Conventions",
  manifests: "Manifest Import",
  pricing_rules: "Pricing Rules",
  sams_pallets: "Sam's Club",
  tasks: "Tasks",
  customers: "Customers",
  carriers: "Carriers",
  documents: "Documents",
  yard_trailers: "Drop Trailers",
  routes: "Route Optimizer",
  inventory_items: "Inventory",
  inventory_movements: "Inventory Movements",
  form_templates: "Forms",
  email_logs: "Email Data Log",
  profiles: "Team (roles)",
  user_module_access: "Team (module access)",
};

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  INSERT: { label: "Added", cls: "bg-emerald-100 text-emerald-700" },
  UPDATE: { label: "Updated", cls: "bg-blue-100 text-blue-700" },
  DELETE: { label: "Deleted", cls: "bg-red-100 text-red-700" },
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "numeric", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" });
};

export default function Activity() {
  const [userFilter, setUserFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const logQ = useQuery({
    queryKey: ["activity_log"],
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameById = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p.full_name ?? p.email ?? p.id])),
    [profilesQ.data],
  );
  const userName = (r: ActivityRow) => (r.user_id ? nameById.get(r.user_id) ?? r.user_id.slice(0, 8) : "system");

  const rows = useMemo(() => {
    let out = logQ.data ?? [];
    if (userFilter !== "all") out = out.filter((r) => userName(r) === userFilter);
    if (moduleFilter !== "all") out = out.filter((r) => r.table_name === moduleFilter);
    if (actionFilter !== "all") out = out.filter((r) => r.action === actionFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => (r.ref ?? "").toLowerCase().includes(q));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logQ.data, userFilter, moduleFilter, actionFilter, search, nameById]);

  const users = useMemo(
    () => Array.from(new Set((logQ.data ?? []).map(userName))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logQ.data, nameById],
  );
  const modules = useMemo(
    () => Array.from(new Set((logQ.data ?? []).map((r) => r.table_name))).sort(),
    [logQ.data],
  );

  const doExport = () =>
    exportCsv(
      rows.map((r) => ({
        when: r.created_at,
        user: userName(r),
        action: ACTION_LABELS[r.action]?.label ?? r.action,
        module: TABLE_LABELS[r.table_name] ?? r.table_name,
        item: r.ref,
      })),
      "activity_log",
    );

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Who did what, where, and when — every add, edit and delete is tracked automatically (latest 1,000 events)."
        action={<button onClick={doExport} {...exportButtonProps(rows.length)}>Export CSV</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All users</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{TABLE_LABELS[m] ?? m}</option>)}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All actions</option>
          <option value="INSERT">Added</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item (ref, SKU, file…)"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400">{rows.length} event{rows.length === 1 ? "" : "s"}</span>
      </div>

      <DataTable<ActivityRow>
        rows={rows}
        isLoading={logQ.isLoading}
        error={logQ.error}
        rowKey={(r) => r.id}
        empty="No activity recorded yet — events appear as your team works."
        columns={[
          { header: "When", cell: (r) => fmtWhen(r.created_at), sort: (r) => r.created_at },
          { header: "User", cell: (r) => <span className="font-medium">{userName(r)}</span>, sort: (r) => userName(r) },
          {
            header: "Action",
            cell: (r) => {
              const a = ACTION_LABELS[r.action] ?? { label: r.action, cls: "bg-slate-200 text-slate-600" };
              return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.cls}`}>{a.label}</span>;
            },
            sort: (r) => r.action,
          },
          { header: "Module", cell: (r) => TABLE_LABELS[r.table_name] ?? r.table_name, sort: (r) => r.table_name },
          { header: "Item", cell: (r) => <span className="font-mono text-xs">{r.ref ?? "—"}</span>, sort: (r) => r.ref },
        ]}
      />
    </div>
  );
}
