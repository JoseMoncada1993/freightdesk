import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/shipments", label: "Shipments" },
  { to: "/billing", label: "Billing" },
  { to: "/trailers", label: "Drop Trailers" },
  { to: "/inventory", label: "Inventory" },
  { to: "/customers", label: "Customers" },
  { to: "/carriers", label: "Carriers" },
  { to: "/documents", label: "Documents" },
  { to: "/tasks", label: "Tasks" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-100 p-4 flex flex-col gap-1 min-h-screen">
      <div className="text-xl font-bold px-2 py-3 text-brand-light">FreightDesk</div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive ? "bg-brand text-white" : "hover:bg-slate-800"
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </aside>
  );
}
