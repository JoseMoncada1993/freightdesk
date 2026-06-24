import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LoadEnriched } from "@/lib/types";

// Reads the loads_enriched view (loads joined to carriers + lanes).
export function useLoads() {
  return useQuery({
    queryKey: ["loads"],
    queryFn: async (): Promise<LoadEnriched[]> => {
      const { data, error } = await supabase
        .from("loads_enriched")
        .select("*")
        .order("pickup_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
