import { NavLink } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABELS } from "@/lib/permissions";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/shipments", label: "Shipments" },
  { to: "/billing", label: "Billing" },
  { to: "/trailers", label: "Drop Trailers" },
  { to: "/inventory", label: "Inventory" },
  { to: "/sams", label: "Sam's Club" },
  { to: "/skus", label: "SKU Generator" },
  { to: "/customers", label: "Customers" },
  { to: "/carriers", label: "Carriers" },
  { to: "/documents", label: "Documents" },
  { to: "/tasks", label: "Tasks" },
];

export default function Sidebar() {
  const { role, isAdmin } = useAuth();
  const items = isAdmin ? [...links, { to: "/team", label: "Team" }] : links;

  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-100 p-4 flex flex-col gap-1 min-h-screen">
      <div className="text-xl font-bold px-2 py-3 text-brand-light">FreightDesk</div>
      {items.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={"end" in l ? l.end : undefined}
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive ? "bg-brand text-white" : "hover:bg-slate-800"
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
      {role && (
        <div className="mt-auto px-3 py-2 text-xs text-slate-400">
          Signed in as <span className="text-slate-200 font-medium">{ROLE_LABELS[role] ?? role}</span>
        </div>
      )}
    </aside>
  );
}
