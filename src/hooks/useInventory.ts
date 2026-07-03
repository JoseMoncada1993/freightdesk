import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type {
  InventoryItem,
  InventoryLevelEnriched,
  InventoryMovementEnriched,
  MovementType,
  Warehouse,
} from "@/lib/types";

type ItemInsert = Database["public"]["Tables"]["inventory_items"]["Insert"];
type WarehouseInsert = Database["public"]["Tables"]["warehouses"]["Insert"];

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: async (): Promise<Warehouse[]> => {
      const { data, error } = await supabase.from("warehouses").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory_items"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventoryLevels() {
  return useQuery({
    queryKey: ["inventory_levels"],
    queryFn: async (): Promise<InventoryLevelEnriched[]> => {
      const { data, error } = await supabase
        .from("inventory_levels_enriched")
        .select("*")
        .order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventoryMovements(limit = 25) {
  return useQuery({
    queryKey: ["inventory_movements", limit],
    queryFn: async (): Promise<InventoryMovementEnriched[]> => {
      const { data, error } = await supabase
        .from("inventory_movements_enriched")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WarehouseInsert) => {
      const { error } = await supabase.from("warehouses").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useAddInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      initialWarehouseId,
      initialQty,
      ...input
    }: ItemInsert & { initialWarehouseId?: number; initialQty?: number }) => {
      const { data: item, error } = await supabase
        .from("inventory_items")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      // Optionally receive opening stock into a warehouse in the same step.
      if (initialWarehouseId && initialQty && initialQty > 0) {
        const { error: mvError } = await supabase.rpc("record_inventory_movement", {
          p_warehouse_id: initialWarehouseId,
          p_item_id: item.id,
          p_movement_type: "inbound",
          p_qty: initialQty,
          p_notes: "Opening stock (added with item)",
        });
        if (mvError) throw mvError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_items"] });
      qc.invalidateQueries({ queryKey: ["inventory_levels"] });
      qc.invalidateQueries({ queryKey: ["inventory_movements"] });
    },
  });
}

export interface MovementInput {
  warehouseId: number;
  movementType: MovementType;
  /** One or many SKUs moved together (bulk). */
  items: { itemId: number; qty: number }[];
  loadRef?: string;
  notes?: string;
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MovementInput) => {
      for (const it of input.items) {
        const { error } = await supabase.rpc("record_inventory_movement", {
          p_warehouse_id: input.warehouseId,
          p_item_id: it.itemId,
          p_movement_type: input.movementType,
          p_qty: it.qty,
          p_load_ref: input.loadRef || undefined,
          p_notes: input.notes || undefined,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_levels"] });
      qc.invalidateQueries({ queryKey: ["inventory_movements"] });
    },
  });
}
