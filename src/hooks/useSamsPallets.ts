import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { SamsPallet } from "@/lib/types";

const PAGE = 1000;

// Fetch every pallet. Supabase caps each request at 1000 rows, so page through.
export function useSamsPallets() {
  return useQuery({
    queryKey: ["sams_pallets"],
    queryFn: async (): Promise<SamsPallet[]> => {
      const out: SamsPallet[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("sams_pallets")
          .select("*")
          .order("club", { ascending: true })
          .order("sku", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data ?? [];
        out.push(...batch);
        if (batch.length < PAGE) break;
      }
      return out;
    },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Bulk set status on a set of rows (the "Update Status" action).
export function useUpdateSamsStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string | null }) => {
      for (const group of chunk(ids, 400)) {
        const { error } = await supabase
          .from("sams_pallets")
          .update({ status, updated_at: new Date().toISOString() })
          .in("id", group);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sams_pallets"] }),
  });
}

// Single-row edit (inline status, notes, delivery date, etc.).
export function useUpdateSamsPallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: number } & Omit<Database["public"]["Tables"]["sams_pallets"]["Update"], "id">) => {
      const { error } = await supabase
        .from("sams_pallets")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sams_pallets"] }),
  });
}

// Import: upsert on pallet_id so re-importing updates existing pallets instead
// of erroring on the unique constraint. Chunked to stay under payload limits.
export function useUpsertSamsPallets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Database["public"]["Tables"]["sams_pallets"]["Insert"][]) => {
      // Collapse duplicate pallet_ids (last wins) — Postgres upsert can't touch
      // the same conflict target twice in one statement.
      const byPallet = new Map<string, Database["public"]["Tables"]["sams_pallets"]["Insert"]>();
      for (const r of rows) {
        if (!r.pallet_id) continue;
        byPallet.set(String(r.pallet_id), { ...r, updated_at: new Date().toISOString() });
      }
      for (const group of chunk([...byPallet.values()], 500)) {
        const { error } = await supabase
          .from("sams_pallets")
          .upsert(group, { onConflict: "pallet_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sams_pallets"] }),
  });
}

export function useDeleteSamsPallets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const group of chunk(ids, 400)) {
        const { error } = await supabase.from("sams_pallets").delete().in("id", group);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sams_pallets"] }),
  });
}
