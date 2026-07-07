import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { Sku } from "@/lib/types";

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
      const { error } = await supabase.from("skus").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skus"] }),
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
