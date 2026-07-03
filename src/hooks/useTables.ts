import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { Carrier, Customer, CustomerAddress, TaskRecord, DocumentRecord } from "@/lib/types";

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

export function useCustomerAddresses() {
  return useQuery({
    queryKey: ["customer_addresses"],
    queryFn: async (): Promise<CustomerAddress[]> => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .order("customer_id")
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddCustomerAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["customer_addresses"]["Insert"]) => {
      const { error } = await supabase.from("customer_addresses").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer_addresses"] }),
  });
}

export function useUpdateCustomerAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: number } & Omit<Database["public"]["Tables"]["customer_addresses"]["Update"], "id">) => {
      const { error } = await supabase.from("customer_addresses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer_addresses"] }),
  });
}

export function useDeleteCustomerAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer_addresses"] }),
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
