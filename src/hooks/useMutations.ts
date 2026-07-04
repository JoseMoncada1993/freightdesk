// Shared insert/update mutations for customers, carriers, tasks, loads, documents.
// Note: identity PKs are typed `id?: never` in generated Insert/Update types, so
// update payloads are modeled as { id } & Omit<Update, "id">.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
type UpdateOf<K extends keyof Tables> = { id: number } & Omit<Tables[K]["Update"], "id">;

function useInvalidate(keys: string[]) {
  const qc = useQueryClient();
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useAddCustomer() {
  const invalidate = useInvalidate(["customers"]);
  return useMutation({
    mutationFn: async (input: Tables["customers"]["Insert"]) => {
      const { error } = await supabase.from("customers").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCustomer() {
  const invalidate = useInvalidate(["customers"]);
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateOf<"customers">) => {
      const { error } = await supabase.from("customers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddCarrier() {
  const invalidate = useInvalidate(["carriers"]);
  return useMutation({
    mutationFn: async (input: Tables["carriers"]["Insert"]) => {
      const { error } = await supabase.from("carriers").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCarrier() {
  const invalidate = useInvalidate(["carriers"]);
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateOf<"carriers">) => {
      const { error } = await supabase.from("carriers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCarrier() {
  const invalidate = useInvalidate(["carriers"]);
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("carriers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddTask() {
  const invalidate = useInvalidate(["tasks"]);
  return useMutation({
    mutationFn: async (input: Tables["tasks"]["Insert"]) => {
      const { error } = await supabase.from("tasks").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate(["tasks"]);
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateOf<"tasks">) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateLoad() {
  const invalidate = useInvalidate(["loads"]);
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateOf<"loads">) => {
      const { error } = await supabase
        .from("loads")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/**
 * Insert or update a full shipment. On insert, also creates a lane
 * (origin/destination labels + miles) so the lane column stays populated.
 */
export function useSaveFullLoad() {
  const invalidate = useInvalidate(["loads"]);
  return useMutation({
    mutationFn: async ({
      id,
      laneOrigin,
      laneDestination,
      laneMiles,
      ...fields
    }: Omit<Tables["loads"]["Insert"], "id" | "lane_id"> & {
      id?: number;
      laneOrigin?: string;
      laneDestination?: string;
      laneMiles?: number | null;
    }) => {
      if (id != null) {
        const { error } = await supabase
          .from("loads")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return;
      }
      let laneId: number | null = null;
      if (laneOrigin && laneDestination) {
        const { data: lane, error: laneError } = await supabase
          .from("lanes")
          .insert({ origin: laneOrigin, destination: laneDestination, miles: laneMiles ?? null })
          .select("id")
          .single();
        if (laneError) throw laneError;
        laneId = lane.id;
      }
      const { error } = await supabase.from("loads").insert({ ...fields, lane_id: laneId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddDocument() {
  const invalidate = useInvalidate(["documents"]);
  return useMutation({
    mutationFn: async (input: Tables["documents"]["Insert"]) => {
      const { error } = await supabase.from("documents").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
