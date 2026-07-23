// App navigation. Collapsible: the toggle shrinks the rail to icon-size
// abbreviations so modules get the full screen width (state persists locally).
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABELS } from "@/lib/permissions";
import type { WriteModule } from "@/lib/permissions";

// `mod` links a nav item to a module key so admins can hide it per user.
// Dashboard has no module (always visible); Team is admin-only.
const links: { to: string; label: string; abbr: string; end?: boolean; mod?: WriteModule }[] = [
  { to: "/", label: "Dashboard", abbr: "Da", end: true },
  { to: "/shipments", label: "Shipments", abbr: "Sh", mod: "shipments" },
  { to: "/billing", label: "Billing", abbr: "Bi", mod: "billing" },
  { to: "/trailers", label: "Drop Trailers", abbr: "Tr", mod: "trailers" },
  { to: "/routes", label: "Route Optimizer", abbr: "Ro", mod: "routes" },
  { to: "/inventory", label: "Inventory", abbr: "In", mod: "inventory" },
  { to: "/sams", label: "Sam's Club", abbr: "SC", mod: "sams" },
  { to: "/skus", label: "SKU Generator", abbr: "SK", mod: "skus" },
  { to: "/manifests", label: "Manifest Import", abbr: "MI", mod: "manifests" },
  { to: "/customers", label: "Customers", abbr: "Cu", mod: "customers" },
  { to: "/carriers", label: "Carriers", abbr: "Ca", mod: "carriers" },
  { to: "/documents", label: "Documents", abbr: "Do", mod: "documents" },
  { to: "/tasks", label: "Tasks", abbr: "Ta", mod: "tasks" },
  { to: "/forms", label: "Forms", abbr: "Fo", mod: "forms" },
  { to: "/emails", label: "Email Data Log", abbr: "Em", mod: "emails" },
];

export default function Sidebar() {
  const { role, isAdmin, isHidden } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("fd_sidebar") === "collapsed");

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("fd_sidebar", c ? "open" : "collapsed");
      return !c;
    });
  };

  const visible = links.filter((l) => !l.mod || !isHidden(l.mod));
  const items = isAdmin ? [...visible, { to: "/team", label: "Team", abbr: "Te" }] : visible;

  return (
    <aside
      className={`${collapsed ? "w-14" : "w-56"} shrink-0 bg-slate-900 text-slate-100 p-2 flex flex-col gap-1 min-h-screen transition-all duration-200`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-1 py-3`}>
        {!collapsed && <span className="text-xl font-bold px-1 text-brand-light">FreightDesk</span>}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      {items.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={"end" in l ? l.end : undefined}
          title={l.label}
          className={({ isActive }) =>
            `${collapsed ? "px-0 text-center" : "px-3"} py-2 rounded-md text-sm font-medium transition ${
              isActive ? "bg-brand text-white" : "hover:bg-slate-800"
            }`
          }
        >
          {collapsed ? <span className="text-xs font-bold">{l.abbr}</span> : l.label}
        </NavLink>
      ))}
      {role && !collapsed && (
        <div className="mt-auto px-3 py-2 text-xs text-slate-400">
          Signed in as <span className="text-slate-200 font-medium">{ROLE_LABELS[role] ?? role}</span>
        </div>
      )}
    </aside>
  );
}
