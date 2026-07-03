import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { YardTrailerEnriched } from "@/lib/types";

type TrailerInsert = Database["public"]["Tables"]["yard_trailers"]["Insert"];
type TrailerUpdate = { id: number } & Omit<
  Database["public"]["Tables"]["yard_trailers"]["Update"],
  "id"
>;

export function useYardTrailers() {
  return useQuery({
    queryKey: ["yard_trailers"],
    queryFn: async (): Promise<YardTrailerEnriched[]> => {
      const { data, error } = await supabase
        .from("yard_trailers_enriched")
        .select("*")
        .order("gate_in_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTrailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TrailerInsert) => {
      const { error } = await supabase.from("yard_trailers").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["yard_trailers"] }),
  });
}

export function useUpdateTrailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TrailerUpdate) => {
      const { error } = await supabase
        .from("yard_trailers")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["yard_trailers"] }),
  });
}
