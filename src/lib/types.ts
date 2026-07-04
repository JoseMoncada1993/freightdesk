// Domain types for FreightDesk. Mirrors src/lib/database.types.ts.
// Regenerate DB types with: npm run db:types
import type { Database } from "./database.types";

export type Carrier = Database["public"]["Tables"]["carriers"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerAddress = Database["public"]["Tables"]["customer_addresses"]["Row"];
export type Lane = Database["public"]["Tables"]["lanes"]["Row"];
export type Load = Database["public"]["Tables"]["loads"]["Row"];
export type DocumentRecord = Database["public"]["Tables"]["documents"]["Row"];
export type TaskRecord = Database["public"]["Tables"]["tasks"]["Row"];
export type Warehouse = Database["public"]["Tables"]["warehouses"]["Row"];
export type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
export type YardTrailer = Database["public"]["Tables"]["yard_trailers"]["Row"];

export type LoadEnriched = Database["public"]["Views"]["loads_enriched"]["Row"];
export type YardTrailerEnriched = Database["public"]["Views"]["yard_trailers_enriched"]["Row"];
export type InventoryLevelEnriched = Database["public"]["Views"]["inventory_levels_enriched"]["Row"];
export type InventoryMovementEnriched = Database["public"]["Views"]["inventory_movements_enriched"]["Row"];

export type LoadStatus =
  | "pending"
  | "quoted"
  | "booked"
  | "in_transit"
  | "delayed"
  | "exception"
  | "delivered"
  | "cancelled";

export const LOAD_STATUSES: LoadStatus[] = [
  "pending",
  "quoted",
  "booked",
  "in_transit",
  "delayed",
  "exception",
  "delivered",
  "cancelled",
];

export const TRANSPORT_TYPES = [
  "FTL",
  "LTL",
  "Container",
  "Direct LTL",
  "Domestic",
  "Direct Domestic",
  "Direct Truckload",
] as const;

export type TrailerStatus = "Empty" | "Loaded" | "Partial" | "Out of service" | "Reserved";

export const TRAILER_STATUSES: TrailerStatus[] = [
  "Empty",
  "Loaded",
  "Partial",
  "Out of service",
  "Reserved",
];

export type MovementType = "inbound" | "outbound" | "adjustment";

export type TaskStatus = "open" | "in_progress" | "done";

export const TASK_STATUSES: TaskStatus[] = ["open", "in_progress", "done"];

export type TaskRecurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export const TASK_RECURRENCES: TaskRecurrence[] = ["none", "daily", "weekly", "biweekly", "monthly"];

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export const DOC_TYPES = [
  "BOL",
  "POD",
  "Invoice",
  "Rate confirmation",
  "COI",
  "W-9",
  "Carrier packet",
  "Other",
] as const;
