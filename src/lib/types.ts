// Domain types for FreightDesk. Mirrors src/lib/database.types.ts.
// Regenerate DB types with: npm run db:types
import type { Database } from "./database.types";

export type Carrier = Database["public"]["Tables"]["carriers"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Lane = Database["public"]["Tables"]["lanes"]["Row"];
export type Load = Database["public"]["Tables"]["loads"]["Row"];
export type DocumentRecord = Database["public"]["Tables"]["documents"]["Row"];
export type TaskRecord = Database["public"]["Tables"]["tasks"]["Row"];
export type LoadEnriched = Database["public"]["Views"]["loads_enriched"]["Row"];

export type LoadStatus =
  | "quoted"
  | "booked"
  | "in_transit"
  | "delivered"
  | "cancelled";
