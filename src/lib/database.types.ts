export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      carriers: {
        Row: {
          active: boolean
          created_at: string
          id: number
          mode: string
          name: string
          scac: string | null
          entity_type: string | null
          legal_name: string | null
          dba: string | null
          mc_number: string | null
          usdot_number: string | null
          ff_docket: string | null
          ein: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          address1: string | null
          address2: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          country: string | null
          insurance_company: string | null
          policy_number: string | null
          cargo_coverage: string | null
          liability_coverage: string | null
          coi_expiration: string | null
          authority_status: string | null
          operating_status: string | null
          safety_rating: string | null
          onboarding_status: string | null
          onboarding_date: string | null
          factoring_company: string | null
          remittance_name: string | null
          document_url: string | null
          notes: string | null
          w9_file_path: string | null
          coi_file_path: string | null
          w9_received: boolean
          coi_received: boolean
          carrier_packet_received: boolean
          identity_verified: boolean
          phone_verified: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: never
          mode?: string
          name: string
          scac?: string | null
          entity_type?: string | null
          legal_name?: string | null
          dba?: string | null
          mc_number?: string | null
          usdot_number?: string | null
          ff_docket?: string | null
          ein?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          address1?: string | null
          address2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string | null
          insurance_company?: string | null
          policy_number?: string | null
          cargo_coverage?: string | null
          liability_coverage?: string | null
          coi_expiration?: string | null
          authority_status?: string | null
          operating_status?: string | null
          safety_rating?: string | null
          onboarding_status?: string | null
          onboarding_date?: string | null
          factoring_company?: string | null
          remittance_name?: string | null
          document_url?: string | null
          notes?: string | null
          w9_file_path?: string | null
          coi_file_path?: string | null
          w9_received?: boolean
          coi_received?: boolean
          carrier_packet_received?: boolean
          identity_verified?: boolean
          phone_verified?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: never
          mode?: string
          name?: string
          scac?: string | null
          entity_type?: string | null
          legal_name?: string | null
          dba?: string | null
          mc_number?: string | null
          usdot_number?: string | null
          ff_docket?: string | null
          ein?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          address1?: string | null
          address2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string | null
          insurance_company?: string | null
          policy_number?: string | null
          cargo_coverage?: string | null
          liability_coverage?: string | null
          coi_expiration?: string | null
          authority_status?: string | null
          operating_status?: string | null
          safety_rating?: string | null
          onboarding_status?: string | null
          onboarding_date?: string | null
          factoring_company?: string | null
          remittance_name?: string | null
          document_url?: string | null
          notes?: string | null
          w9_file_path?: string | null
          coi_file_path?: string | null
          w9_received?: boolean
          coi_received?: boolean
          carrier_packet_received?: boolean
          identity_verified?: boolean
          phone_verified?: boolean
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: number
          name: string
          address1: string | null
          address2: string | null
          business_hours: string | null
          city: string | null
          company_name: string | null
          facility_type: string | null
          first_name: string | null
          last_name: string | null
          special_instructions: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: never
          name?: string
          address1?: string | null
          address2?: string | null
          business_hours?: string | null
          city?: string | null
          company_name?: string | null
          facility_type?: string | null
          first_name?: string | null
          last_name?: string | null
          special_instructions?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: never
          name?: string
          address1?: string | null
          address2?: string | null
          business_hours?: string | null
          city?: string | null
          company_name?: string | null
          facility_type?: string | null
          first_name?: string | null
          last_name?: string | null
          special_instructions?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          doc_type: string
          file_path: string
          id: number
          load_id: number | null
          uploaded_at: string
        }
        Insert: {
          doc_type: string
          file_path: string
          id?: never
          load_id?: number | null
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          file_path?: string
          id?: never
          load_id?: number | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      lanes: {
        Row: {
          created_at: string
          destination: string
          id: number
          miles: number | null
          origin: string
        }
        Insert: {
          created_at?: string
          destination: string
          id?: never
          miles?: number | null
          origin: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: never
          miles?: number | null
          origin?: string
        }
        Relationships: []
      }
      loads: {
        Row: {
          carrier_id: number | null
          created_at: string
          customer_id: number | null
          delivered_at: string | null
          eta: string | null
          id: number
          lane_id: number | null
          on_time: boolean | null
          pickup_at: string | null
          rate_usd: number | null
          ref: string
          status: string
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          carrier_id?: number | null
          created_at?: string
          customer_id?: number | null
          delivered_at?: string | null
          eta?: string | null
          id?: never
          lane_id?: number | null
          on_time?: boolean | null
          pickup_at?: string | null
          rate_usd?: number | null
          ref: string
          status?: string
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          carrier_id?: number | null
          created_at?: string
          customer_id?: number | null
          delivered_at?: string | null
          eta?: string | null
          id?: never
          lane_id?: number | null
          on_time?: boolean | null
          pickup_at?: string | null
          rate_usd?: number | null
          ref?: string
          status?: string
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loads_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loads_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee: string | null
          created_at: string
          due_date: string | null
          id: number
          load_id: number | null
          status: string
          title: string
          notes: string | null
          archived: boolean
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          due_date?: string | null
          id?: never
          load_id?: number | null
          status?: string
          title: string
          notes?: string | null
          archived?: boolean
        }
        Update: {
          assignee?: string | null
          created_at?: string
          due_date?: string | null
          id?: never
          load_id?: number | null
          status?: string
          title?: string
          notes?: string | null
          archived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tasks_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      loads_enriched: {
        Row: {
          carrier_mode: string | null
          carrier_name: string | null
          delivered_at: string | null
          destination: string | null
          eta: string | null
          id: number | null
          lane: string | null
          miles: number | null
          on_time: boolean | null
          origin: string | null
          pickup_at: string | null
          rate_usd: number | null
          ref: string | null
          status: string | null
          weight_lbs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_load: {
        Args: {
          p_carrier: string
          p_destination: string
          p_eta?: string
          p_origin: string
          p_pickup?: string
          p_rate?: number
          p_ref: string
          p_status?: string
          p_weight?: number
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
