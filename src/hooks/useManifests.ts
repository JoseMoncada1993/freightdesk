// Data hooks for the Manifest Import module: manifests, reusable header
// mappings, pricing rules, and small app settings (Google client ID).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { Manifest, ManifestMapping, PricingRule } from "@/lib/types";

type Tables = Database["public"]["Tables"];

export function useManifests() {
  return useQuery({
    queryKey: ["manifests"],
    queryFn: async (): Promise<Manifest[]> => {
      const { data, error } = await supabase
        .from("manifests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Tables["manifests"]["Insert"]) => {
      const { data, error } = await supabase.from("manifests").insert(input).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifests"] }),
  });
}

export function useUpdateManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: number } & Omit<Tables["manifests"]["Update"], "id">) => {
      const { error } = await supabase
        .from("manifests")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifests"] }),
  });
}

export function useDeleteManifest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("manifests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifests"] }),
  });
}

// ---- Saved header mappings --------------------------------------------------

export function useManifestMappings() {
  return useQuery({
    queryKey: ["manifest_mappings"],
    queryFn: async (): Promise<ManifestMapping[]> => {
      const { data, error } = await supabase
        .from("manifest_mappings")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveManifestMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Tables["manifest_mappings"]["Insert"]) => {
      const { error } = await supabase
        .from("manifest_mappings")
        .upsert(input, { onConflict: "name" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifest_mappings"] }),
  });
}

export function useDeleteManifestMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("manifest_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manifest_mappings"] }),
  });
}

// ---- Pricing rules ------------------------------------------------------------

export function usePricingRules() {
  return useQuery({
    queryKey: ["pricing_rules"],
    queryFn: async (): Promise<PricingRule[]> => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("*")
        .order("supplier", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSavePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: Omit<Tables["pricing_rules"]["Insert"], "id"> & { id?: number }) => {
      if (id != null) {
        const { error } = await supabase.from("pricing_rules").update(fields).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_rules").insert(fields);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing_rules"] }),
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing_rules"] }),
  });
}

// ---- App settings --------------------------------------------------------------

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ["app_settings", key],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? null;
    },
  });
}

export function useSetAppSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["app_settings", v.key] }),
  });
}
