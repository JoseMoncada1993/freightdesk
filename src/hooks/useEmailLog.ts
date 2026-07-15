// Data hooks for the Email Data Log module: supplier ingestion rules and the
// per-email log (deduped on gmail_message_id — the old Apps Script's
// "Processed" sheet).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { EmailLog, EmailRule } from "@/lib/types";

type Tables = Database["public"]["Tables"];

export function useEmailRules() {
  return useQuery({
    queryKey: ["email_rules"],
    queryFn: async (): Promise<EmailRule[]> => {
      const { data, error } = await supabase
        .from("email_rules")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveEmailRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: Omit<Tables["email_rules"]["Insert"], "id"> & { id?: number }) => {
      if (id != null) {
        const { error } = await supabase
          .from("email_rules")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_rules").insert(fields);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_rules"] }),
  });
}

export function useDeleteEmailRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("email_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_rules"] }),
  });
}

const PAGE = 1000;

export function useEmailLogs() {
  return useQuery({
    queryKey: ["email_logs"],
    queryFn: async (): Promise<EmailLog[]> => {
      const out: EmailLog[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("email_logs")
          .select("*")
          .order("received_at", { ascending: false })
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

/** Import parsed emails; upsert on gmail_message_id so re-runs skip duplicates. */
export function useUpsertEmailLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Tables["email_logs"]["Insert"][]) => {
      const { error } = await supabase
        .from("email_logs")
        .upsert(rows, { onConflict: "gmail_message_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_logs"] }),
  });
}

export function useDeleteEmailLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from("email_logs").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_logs"] }),
  });
}
