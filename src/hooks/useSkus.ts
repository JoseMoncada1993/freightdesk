import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { Sku, SkuConvention } from "@/lib/types";

export function useSkus() {
  return useQuery({
    queryKey: ["skus"],
    queryFn: async (): Promise<Sku[]> => {
      const { data, error } = await supabase
        .from("skus")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["skus"]["Insert"]) => {
      const { data, error } = await supabase.from("skus").insert(input).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
  });
}

// Bulk insert — used by the Shipments "Generate SKUs" flow.
export function useAddSkus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: Database["public"]["Tables"]["skus"]["Insert"][]) => {
      const { error } = await supabase.from("skus").insert(inputs);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
  });
}

// Supplier → location/program/prefix reference used to auto-fill the generator.
export function useSkuConventions() {
  return useQuery({
    queryKey: ["sku_conventions"],
    queryFn: async (): Promise<SkuConvention[]> => {
      const { data, error } = await supabase
        .from("sku_conventions")
        .select("*")
        .order("supplier", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Add or update a supplier convention (upsert on the unique supplier name).
export function useAddSkuConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["sku_conventions"]["Insert"]) => {
      const { error } = await supabase
        .from("sku_conventions")
        .upsert(input, { onConflict: "supplier" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sku_conventions"] }),
  });
}

export function useDeleteSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("skus").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
  });
}

// Update a generated SKU (archive/restore, edit the SKU value, export fields…).
export function useUpdateSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: number } & Omit<Database["public"]["Tables"]["skus"]["Update"], "id">) => {
      const { error } = await supabase.from("skus").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
  });
}

// Bulk-apply the same patch (archive/restore, supplier, notes…) to many SKUs.
export function useBulkUpdateSkus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: {
      ids: number[];
      patch: Omit<Database["public"]["Tables"]["skus"]["Update"], "id">;
    }) => {
      const { error } = await supabase.from("skus").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
  });
}

// Bulk per-row patches (each SKU gets its own values — e.g. merged export
// fields). Runs the updates in parallel.
export function useBulkPatchSkus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patches: { id: number; patch: Omit<Database["public"]["Tables"]["skus"]["Update"], "id"> }[],
    ) => {
      const results = await Promise.all(
        patches.map(({ id, patch }) => supabase.from("skus").update(patch).eq("id", id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
  });
}

export function useUpdateSkuConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: number } & Omit<Database["public"]["Tables"]["sku_conventions"]["Update"], "id">) => {
      const { error } = await supabase.from("sku_conventions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sku_conventions"] }),
  });
}

export function useDeleteSkuConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("sku_conventions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sku_conventions"] }),
  });
}
