import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Carrier, Customer, TaskRecord, DocumentRecord } from "@/lib/types";

export function useCarriers() {
  return useQuery({
    queryKey: ["carriers"],
    queryFn: async (): Promise<Carrier[]> => {
      const { data, error } = await supabase.from("carriers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<TaskRecord[]> => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<DocumentRecord[]> => {
      const { data, error } = await supabase.from("documents").select("*").order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
