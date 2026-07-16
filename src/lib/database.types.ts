export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      carriers: {
        Row: {
          active: boolean
          address1: string | null
          address2: string | null
          authority_status: string | null
          cargo_coverage: string | null
          carrier_packet_received: boolean
          city: string | null
          coi_expiration: string | null
          coi_file_path: string | null
          coi_received: boolean
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          dba: string | null
          document_url: string | null
          ein: string | null
          entity_type: string | null
          factoring_company: string | null
          ff_docket: string | null
          id: number
          identity_verified: boolean
          insurance_company: string | null
          legal_name: string | null
          liability_coverage: string | null
          mc_number: string | null
          mode: string
          name: string
          notes: string | null
          onboarding_date: string | null
          onboarding_status: string | null
          operating_status: string | null
          phone_verified: boolean
          policy_number: string | null
          remittance_name: string | null
          safety_rating: string | null
          scac: string | null
          state: string | null
          usdot_number: string | null
          w9_file_path: string | null
          w9_received: boolean
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address1?: string | null
          address2?: string | null
          authority_status?: string | null
          cargo_coverage?: string | null
          carrier_packet_received?: boolean
          city?: string | null
          coi_expiration?: string | null
          coi_file_path?: string | null
          coi_received?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          dba?: string | null
          document_url?: string | null
          ein?: string | null
          entity_type?: string | null
          factoring_company?: string | null
          ff_docket?: string | null
          id?: never
          identity_verified?: boolean
          insurance_company?: string | null
          legal_name?: string | null
          liability_coverage?: string | null
          mc_number?: string | null
          mode?: string
          name: string
          notes?: string | null
          onboarding_date?: string | null
          onboarding_status?: string | null
          operating_status?: string | null
          phone_verified?: boolean
          policy_number?: string | null
          remittance_name?: string | null
          safety_rating?: string | null
          scac?: string | null
          state?: string | null
          usdot_number?: string | null
          w9_file_path?: string | null
          w9_received?: boolean
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address1?: string | null
          address2?: string | null
          authority_status?: string | null
          cargo_coverage?: string | null
          carrier_packet_received?: boolean
          city?: string | null
          coi_expiration?: string | null
          coi_file_path?: string | null
          coi_received?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          dba?: string | null
          document_url?: string | null
          ein?: string | null
          entity_type?: string | null
          factoring_company?: string | null
          ff_docket?: string | null
          id?: never
          identity_verified?: boolean
          insurance_company?: string | null
          legal_name?: string | null
          liability_coverage?: string | null
          mc_number?: string | null
          mode?: string
          name?: string
          notes?: string | null
          onboarding_date?: string | null
          onboarding_status?: string | null
          operating_status?: string | null
          phone_verified?: boolean
          policy_number?: string | null
          remittance_name?: string | null
          safety_rating?: string | null
          scac?: string | null
          state?: string | null
          usdot_number?: string | null
          w9_file_path?: string | null
          w9_received?: boolean
          zip_code?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address1: string | null
          address2: string | null
          business_hours: string | null
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_id: number
          facility_type: string | null
          id: number
          is_default: boolean
          label: string
          special_instructions: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          business_hours?: string | null
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id: number
          facility_type?: string | null
          id?: never
          is_default?: boolean
          label: string
          special_instructions?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          address1?: string | null
          address2?: string | null
          business_hours?: string | null
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: number
          facility_type?: string | null
          id?: never
          is_default?: boolean
          label?: string
          special_instructions?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          address1: string | null
          address2: string | null
          business_hours: string | null
          city: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          facility_type: string | null
          first_name: string | null
          id: number
          last_name: string | null
          name: string | null
          special_instructions: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address1?: string | null
          address2?: string | null
          business_hours?: string | null
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facility_type?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          name?: string | null
          special_instructions?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address1?: string | null
          address2?: string | null
          business_hours?: string | null
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facility_type?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          name?: string | null
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
          {
            foreignKeyName: "documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          data: Json
          from_addr: string | null
          gmail_message_id: string
          id: number
          received_at: string | null
          rule_id: number | null
          subject: string | null
          supplier: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          from_addr?: string | null
          gmail_message_id: string
          id?: never
          received_at?: string | null
          rule_id?: number | null
          subject?: string | null
          supplier?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          from_addr?: string | null
          gmail_message_id?: string
          id?: never
          received_at?: string | null
          rule_id?: number | null
          subject?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_rules: {
        Row: {
          active: boolean
          created_at: string
          fields: Json
          from_filter: string | null
          gmail_query: string
          id: number
          name: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fields?: Json
          from_filter?: string | null
          gmail_query: string
          id?: never
          name: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fields?: Json
          from_filter?: string | null
          gmail_query?: string
          id?: never
          name?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      form_responses: {
        Row: {
          created_at: string
          data: Json
          form_id: number
          id: number
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          form_id: number
          id?: never
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          form_id?: number
          id?: never
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          fields: Json
          id: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          fields?: Json
          id?: never
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          fields?: Json
          id?: never
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          active: boolean
          created_at: string
          customer_id: number | null
          description: string
          id: number
          sku: string
          unit_value_usd: number | null
          unit_weight_lbs: number | null
          uom: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: number | null
          description: string
          id?: never
          sku: string
          unit_value_usd?: number | null
          unit_weight_lbs?: number | null
          uom?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: number | null
          description?: string
          id?: never
          sku?: string
          unit_value_usd?: number | null
          unit_weight_lbs?: number | null
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          id: number
          item_id: number
          qty_allocated: number
          qty_on_hand: number
          reorder_point: number | null
          updated_at: string
          warehouse_id: number
        }
        Insert: {
          id?: never
          item_id: number
          qty_allocated?: number
          qty_on_hand?: number
          reorder_point?: number | null
          updated_at?: string
          warehouse_id: number
        }
        Update: {
          id?: never
          item_id?: number
          qty_allocated?: number
          qty_on_hand?: number
          reorder_point?: number | null
          updated_at?: string
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: number
          item_id: number
          load_ref: string | null
          movement_type: string
          notes: string | null
          occurred_at: string
          qty: number
          warehouse_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          item_id: number
          load_ref?: string | null
          movement_type: string
          notes?: string | null
          occurred_at?: string
          qty: number
          warehouse_id: number
        }
        Update: {
          created_at?: string
          id?: never
          item_id?: number
          load_ref?: string | null
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          qty?: number
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          archived: boolean
          bol_number: string | null
          carrier_id: number | null
          carrier_pay_usd: number | null
          commodity: string | null
          consignee_address1: string | null
          consignee_address2: string | null
          consignee_city: string | null
          consignee_contact: string | null
          consignee_name: string | null
          consignee_phone: string | null
          consignee_state: string | null
          consignee_zip: string | null
          created_at: string
          customer_id: number | null
          delivered_at: string | null
          delivery_at: string | null
          dest_city: string | null
          dest_state: string | null
          dest_zip: string | null
          entity: string | null
          equipment_type: string | null
          eta: string | null
          freight_type: string | null
          id: number
          invoice_due_date: string | null
          invoice_number: string | null
          invoiced_at: string | null
          lane_id: number | null
          miles_calc: number | null
          notes: string | null
          on_time: boolean | null
          origin_city: string | null
          origin_state: string | null
          origin_zip: string | null
          paid_at: string | null
          pickup_at: string | null
          qty: number | null
          rate_per_mile: number | null
          rate_usd: number | null
          ref: string
          scheduled_at: string | null
          shipper_address1: string | null
          shipper_address2: string | null
          shipper_city: string | null
          shipper_contact: string | null
          shipper_name: string | null
          shipper_phone: string | null
          shipper_state: string | null
          shipper_zip: string | null
          status: string
          transport_type: string | null
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          archived?: boolean
          bol_number?: string | null
          carrier_id?: number | null
          carrier_pay_usd?: number | null
          commodity?: string | null
          consignee_address1?: string | null
          consignee_address2?: string | null
          consignee_city?: string | null
          consignee_contact?: string | null
          consignee_name?: string | null
          consignee_phone?: string | null
          consignee_state?: string | null
          consignee_zip?: string | null
          created_at?: string
          customer_id?: number | null
          delivered_at?: string | null
          delivery_at?: string | null
          dest_city?: string | null
          dest_state?: string | null
          dest_zip?: string | null
          entity?: string | null
          equipment_type?: string | null
          eta?: string | null
          freight_type?: string | null
          id?: never
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          lane_id?: number | null
          miles_calc?: number | null
          notes?: string | null
          on_time?: boolean | null
          origin_city?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          paid_at?: string | null
          pickup_at?: string | null
          qty?: number | null
          rate_per_mile?: number | null
          rate_usd?: number | null
          ref: string
          scheduled_at?: string | null
          shipper_address1?: string | null
          shipper_address2?: string | null
          shipper_city?: string | null
          shipper_contact?: string | null
          shipper_name?: string | null
          shipper_phone?: string | null
          shipper_state?: string | null
          shipper_zip?: string | null
          status?: string
          transport_type?: string | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          archived?: boolean
          bol_number?: string | null
          carrier_id?: number | null
          carrier_pay_usd?: number | null
          commodity?: string | null
          consignee_address1?: string | null
          consignee_address2?: string | null
          consignee_city?: string | null
          consignee_contact?: string | null
          consignee_name?: string | null
          consignee_phone?: string | null
          consignee_state?: string | null
          consignee_zip?: string | null
          created_at?: string
          customer_id?: number | null
          delivered_at?: string | null
          delivery_at?: string | null
          dest_city?: string | null
          dest_state?: string | null
          dest_zip?: string | null
          entity?: string | null
          equipment_type?: string | null
          eta?: string | null
          freight_type?: string | null
          id?: never
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          lane_id?: number | null
          miles_calc?: number | null
          notes?: string | null
          on_time?: boolean | null
          origin_city?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          paid_at?: string | null
          pickup_at?: string | null
          qty?: number | null
          rate_per_mile?: number | null
          rate_usd?: number | null
          ref?: string
          scheduled_at?: string | null
          shipper_address1?: string | null
          shipper_address2?: string | null
          shipper_city?: string | null
          shipper_contact?: string | null
          shipper_name?: string | null
          shipper_phone?: string | null
          shipper_state?: string | null
          shipper_zip?: string | null
          status?: string
          transport_type?: string | null
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
      manifest_mappings: {
        Row: {
          created_at: string
          id: number
          mapping: Json
          name: string
        }
        Insert: {
          created_at?: string
          id?: never
          mapping: Json
          name: string
        }
        Update: {
          created_at?: string
          id?: never
          mapping?: Json
          name?: string
        }
        Relationships: []
      }
      manifests: {
        Row: {
          created_at: string
          ext_price: number | null
          ext_retail: number | null
          file_name: string | null
          id: number
          item_count: number | null
          mapping: Json | null
          notes: string | null
          price_pct: number | null
          rows: Json
          sku_id: number | null
          source: string
          source_ref: string | null
          status: string
          store: string | null
          total_qty: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ext_price?: number | null
          ext_retail?: number | null
          file_name?: string | null
          id?: never
          item_count?: number | null
          mapping?: Json | null
          notes?: string | null
          price_pct?: number | null
          rows?: Json
          sku_id?: number | null
          source?: string
          source_ref?: string | null
          status?: string
          store?: string | null
          total_qty?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ext_price?: number | null
          ext_retail?: number | null
          file_name?: string | null
          id?: never
          item_count?: number | null
          mapping?: Json | null
          notes?: string | null
          price_pct?: number | null
          rows?: Json
          sku_id?: number | null
          source?: string
          source_ref?: string | null
          status?: string
          store?: string | null
          total_qty?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifests_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          created_at: string
          id: number
          location: string | null
          notes: string | null
          pct: number
          program: string | null
          supplier: string
        }
        Insert: {
          created_at?: string
          id?: never
          location?: string | null
          notes?: string | null
          pct: number
          program?: string | null
          supplier: string
        }
        Update: {
          created_at?: string
          id?: never
          location?: string | null
          notes?: string | null
          pct?: number
          program?: string | null
          supplier?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          id: number
          name: string
          notes: string | null
          round_trip: boolean
          stops: Json
          total_miles: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          notes?: string | null
          round_trip?: boolean
          stops?: Json
          total_miles?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          notes?: string | null
          round_trip?: boolean
          stops?: Json
          total_miles?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sams_pallets: {
        Row: {
          archived: boolean
          club: string | null
          created_at: string
          delivery_date: string | null
          id: number
          notes: string | null
          pallet_id: string
          sku: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          club?: string | null
          created_at?: string
          delivery_date?: string | null
          id?: never
          notes?: string | null
          pallet_id: string
          sku?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          club?: string | null
          created_at?: string
          delivery_date?: string | null
          id?: never
          notes?: string | null
          pallet_id?: string
          sku?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sku_conventions: {
        Row: {
          created_at: string
          id: number
          location: string | null
          prefix: string
          product_template: Json | null
          program: string | null
          supplier: string
        }
        Insert: {
          created_at?: string
          id?: never
          location?: string | null
          prefix: string
          product_template?: Json | null
          program?: string | null
          supplier: string
        }
        Update: {
          created_at?: string
          id?: never
          location?: string | null
          prefix?: string
          product_template?: Json | null
          program?: string | null
          supplier?: string
        }
        Relationships: []
      }
      skus: {
        Row: {
          archived: boolean
          created_at: string
          export_fields: Json | null
          id: number
          load_id: number | null
          load_ref: string | null
          location: string | null
          notes: string | null
          prefix: string
          program: string | null
          sku: string
          supplier: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          export_fields?: Json | null
          id?: never
          load_id?: number | null
          load_ref?: string | null
          location?: string | null
          notes?: string | null
          prefix: string
          program?: string | null
          sku: string
          supplier?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          export_fields?: Json | null
          id?: never
          load_id?: number | null
          load_ref?: string | null
          location?: string | null
          notes?: string | null
          prefix?: string
          program?: string | null
          sku?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skus_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          assignee: string | null
          created_at: string
          due_date: string | null
          id: number
          load_id: number | null
          notes: string | null
          recurrence: string
          status: string
          title: string
        }
        Insert: {
          archived?: boolean
          assignee?: string | null
          created_at?: string
          due_date?: string | null
          id?: never
          load_id?: number | null
          notes?: string | null
          recurrence?: string
          status?: string
          title: string
        }
        Update: {
          archived?: boolean
          assignee?: string | null
          created_at?: string
          due_date?: string | null
          id?: never
          load_id?: number | null
          notes?: string | null
          recurrence?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          active: boolean
          address1: string | null
          city: string | null
          code: string
          created_at: string
          dock_doors: number | null
          id: number
          name: string
          state: string | null
          trailer_spots: number | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address1?: string | null
          city?: string | null
          code: string
          created_at?: string
          dock_doors?: number | null
          id?: never
          name: string
          state?: string | null
          trailer_spots?: number | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address1?: string | null
          city?: string | null
          code?: string
          created_at?: string
          dock_doors?: number | null
          id?: never
          name?: string
          state?: string | null
          trailer_spots?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      yard_trailers: {
        Row: {
          archived: boolean
          carrier_id: number | null
          condition: string | null
          contents: string | null
          created_at: string | null
          gate_in_at: string | null
          gate_out_at: string | null
          id: number
          load_ref: string | null
          notes: string | null
          seal_no: string | null
          site: string
          spot: string | null
          status: string
          trailer_no: string
          updated_at: string | null
        }
        Insert: {
          archived?: boolean
          carrier_id?: number | null
          condition?: string | null
          contents?: string | null
          created_at?: string | null
          gate_in_at?: string | null
          gate_out_at?: string | null
          id?: never
          load_ref?: string | null
          notes?: string | null
          seal_no?: string | null
          site: string
          spot?: string | null
          status?: string
          trailer_no: string
          updated_at?: string | null
        }
        Update: {
          archived?: boolean
          carrier_id?: number | null
          condition?: string | null
          contents?: string | null
          created_at?: string | null
          gate_in_at?: string | null
          gate_out_at?: string | null
          id?: never
          load_ref?: string | null
          notes?: string | null
          seal_no?: string | null
          site?: string
          spot?: string | null
          status?: string
          trailer_no?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yard_trailers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_levels_enriched: {
        Row: {
          customer_name: string | null
          description: string | null
          id: number | null
          item_id: number | null
          low_stock: boolean | null
          qty_allocated: number | null
          qty_available: number | null
          qty_on_hand: number | null
          reorder_point: number | null
          sku: string | null
          unit_weight_lbs: number | null
          uom: string | null
          updated_at: string | null
          warehouse_code: string | null
          warehouse_id: number | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements_enriched: {
        Row: {
          description: string | null
          id: number | null
          item_id: number | null
          load_ref: string | null
          movement_type: string | null
          notes: string | null
          occurred_at: string | null
          qty: number | null
          sku: string | null
          warehouse_code: string | null
          warehouse_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      loads_enriched: {
        Row: {
          archived: boolean | null
          bol_number: string | null
          carrier_id: number | null
          carrier_mode: string | null
          carrier_name: string | null
          carrier_pay_usd: number | null
          carrier_scac: string | null
          commodity: string | null
          consignee_address1: string | null
          consignee_address2: string | null
          consignee_city: string | null
          consignee_contact: string | null
          consignee_name: string | null
          consignee_phone: string | null
          consignee_state: string | null
          consignee_zip: string | null
          created_at: string | null
          customer_id: number | null
          customer_name: string | null
          delivered_at: string | null
          delivery_at: string | null
          dest_city: string | null
          dest_state: string | null
          dest_zip: string | null
          destination: string | null
          entity: string | null
          equipment_type: string | null
          eta: string | null
          freight_type: string | null
          id: number | null
          invoice_due_date: string | null
          invoice_number: string | null
          invoiced_at: string | null
          lane: string | null
          lane_id: number | null
          margin_usd: number | null
          miles: number | null
          miles_calc: number | null
          notes: string | null
          on_time: boolean | null
          origin: string | null
          origin_city: string | null
          origin_state: string | null
          origin_zip: string | null
          paid_at: string | null
          pickup_at: string | null
          qty: number | null
          rate_per_mile: number | null
          rate_usd: number | null
          ref: string | null
          scheduled_at: string | null
          shipper_address1: string | null
          shipper_address2: string | null
          shipper_city: string | null
          shipper_contact: string | null
          shipper_name: string | null
          shipper_phone: string | null
          shipper_state: string | null
          shipper_zip: string | null
          status: string | null
          transport_type: string | null
          updated_at: string | null
          weight_lbs: number | null
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
      yard_trailers_enriched: {
        Row: {
          archived: boolean | null
          carrier_id: number | null
          carrier_name: string | null
          condition: string | null
          contents: string | null
          created_at: string | null
          gate_in_at: string | null
          gate_out_at: string | null
          id: number | null
          load_ref: string | null
          notes: string | null
          seal_no: string | null
          site: string | null
          spot: string | null
          status: string | null
          trailer_no: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yard_trailers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
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
      my_role: { Args: never; Returns: string }
      record_inventory_movement: {
        Args: {
          p_item_id: number
          p_load_ref?: string
          p_movement_type: string
          p_notes?: string
          p_qty: number
          p_warehouse_id: number
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
