import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { SavedRoute } from "@/lib/types";

export function useRoutes() {
  return useQuery({
    queryKey: ["routes"],
    queryFn: async (): Promise<SavedRoute[]> => {
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: Omit<Database["public"]["Tables"]["routes"]["Insert"], "id"> & { id?: number }) => {
      if (id != null) {
        const { error } = await supabase
          .from("routes")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("routes").insert(fields).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}
