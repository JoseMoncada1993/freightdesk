// Data hooks for the Forms module: form templates (builder), public fetch by
// slug, and responses. The public fill page uses the same supabase client —
// RLS lets the anon role read active templates and insert responses only.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { FormResponse, FormTemplate } from "@/lib/types";

type Tables = Database["public"]["Tables"];

export function useFormTemplates() {
  return useQuery({
    queryKey: ["form_templates"],
    queryFn: async (): Promise<FormTemplate[]> => {
      const { data, error } = await supabase
        .from("form_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: Omit<Tables["form_templates"]["Insert"], "id"> & { id?: number }) => {
      if (id != null) {
        const { error } = await supabase
          .from("form_templates")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("form_templates").insert(fields);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form_templates"] }),
  });
}

export function useDeleteFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form_templates"] });
      qc.invalidateQueries({ queryKey: ["form_responses"] });
    },
  });
}

/** Public fill page: fetch one ACTIVE template by its slug (anon-readable). */
export function usePublicForm(slug: string | undefined) {
  return useQuery({
    queryKey: ["public_form", slug],
    enabled: !!slug,
    queryFn: async (): Promise<FormTemplate | null> => {
      const { data, error } = await supabase
        .from("form_templates")
        .select("*")
        .eq("slug", slug!)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSubmitFormResponse() {
  return useMutation({
    mutationFn: async (input: Tables["form_responses"]["Insert"]) => {
      const { error } = await supabase.from("form_responses").insert(input);
      if (error) throw error;
    },
  });
}

/** All responses (staff-only via RLS); filter client-side per form. */
export function useFormResponses() {
  return useQuery({
    queryKey: ["form_responses"],
    queryFn: async (): Promise<FormResponse[]> => {
      const { data, error } = await supabase
        .from("form_responses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeleteFormResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("form_responses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form_responses"] }),
  });
}
