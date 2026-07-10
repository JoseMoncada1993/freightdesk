// Role-based permissions. Mirrors the RLS matrix in
// supabase/migrations/0014_rbac_activation.sql — the database enforces these
// server-side; this module only decides what the UI shows.

export type Role = "admin" | "dispatcher" | "warehouse" | "viewer" | "accounting";

export const ASSIGNABLE_ROLES: Role[] = ["admin", "dispatcher", "warehouse", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  warehouse: "Warehouse",
  viewer: "Viewer",
  accounting: "Accounting",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access, manages the team and roles",
  dispatcher: "Manages shipments, billing, carriers, customers, trailers, tasks, documents",
  warehouse: "Manages inventory, drop trailers, tasks, documents; read-only elsewhere",
  viewer: "Read-only access to everything",
  accounting: "Legacy role — treated like dispatcher for billing",
};

export type WriteModule =
  | "shipments"
  | "billing"
  | "trailers"
  | "inventory"
  | "customers"
  | "carriers"
  | "documents"
  | "tasks"
  | "skus"
  | "sams"
  | "routes"
  | "manifests";

const WRITE_ACCESS: Record<WriteModule, Role[]> = {
  shipments: ["admin", "dispatcher"],
  billing: ["admin", "dispatcher", "accounting"],
  trailers: ["admin", "dispatcher", "warehouse"],
  inventory: ["admin", "warehouse"],
  customers: ["admin", "dispatcher"],
  carriers: ["admin", "dispatcher"],
  documents: ["admin", "dispatcher", "warehouse"],
  tasks: ["admin", "dispatcher", "warehouse"],
  skus: ["admin", "dispatcher"],
  sams: ["admin", "dispatcher", "warehouse"],
  routes: ["admin", "dispatcher"],
  manifests: ["admin", "dispatcher"],
};

export function canWrite(role: Role | null, module: WriteModule): boolean {
  if (!role) return false;
  return WRITE_ACCESS[module]?.includes(role) ?? false;
}

/** Hard deletes (carriers, customers, trailers…) are admin-only. */
export function canDelete(role: Role | null): boolean {
  return role === "admin";
}

export function isAdmin(role: Role | null): boolean {
  return role === "admin";
}
