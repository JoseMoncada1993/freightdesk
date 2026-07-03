import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LoadStatus } from "@/lib/types";

export interface NewLoadInput {
  ref: string;
  originLabel: string;
  destinationLabel: string;
  miles: number | null;
  rateUsd: number | null;
  status: LoadStatus;
}

// Creates the lane (with auto-calculated miles) then the load that references it.
export function useAddLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLoadInput) => {
      const { data: lane, error: laneError } = await supabase
        .from("lanes")
        .insert({
          origin: input.originLabel,
          destination: input.destinationLabel,
          miles: input.miles,
        })
        .select("id")
        .single();
      if (laneError) throw laneError;

      const { data: load, error: loadError } = await supabase
        .from("loads")
        .insert({
          ref: input.ref,
          lane_id: lane.id,
          rate_usd: input.rateUsd,
          status: input.status,
        })
        .select("id")
        .single();
      if (loadError) throw loadError;

      return load;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loads"] });
    },
  });
}
