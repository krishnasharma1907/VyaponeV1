/**
 * VyapOne Supabase Database TypeScript Definitions
 *
 * Generated and aligned with the canonical domain entity architecture
 * defined in docs/diagrams/core-erd.mmd and docs/DOMAIN_ARCHITECTURE.md.
 *
 * Regeneration command (when connected to a live Supabase project):
 *   pnpm supabase gen types typescript --project-id <project-ref> > src/lib/supabase/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          phone_number: string | null;
          status: "active" | "invited" | "suspended" | "pending_verification";
          preferred_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_name: string;
          email?: string | null;
          phone_number?: string | null;
          status?: "active" | "invited" | "suspended" | "pending_verification";
          preferred_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          email?: string | null;
          phone_number?: string | null;
          status?: "active" | "invited" | "suspended" | "pending_verification";
          preferred_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      user_auth_identities: {
        Row: {
          id: string;
          user_id: string;
          provider: "phone_otp" | "email_password" | "google";
          identifier: string;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "phone_otp" | "email_password" | "google";
          identifier: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: "phone_otp" | "email_password" | "google";
          identifier?: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_auth_identities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_user_id: string;
          status: "active" | "suspended" | "archived";
          plan: "starter" | "pro" | "agency";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_user_id: string;
          status?: "active" | "suspended" | "archived";
          plan?: "starter" | "pro" | "agency";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_user_id?: string;
          status?: "active" | "suspended" | "archived";
          plan?: "starter" | "pro" | "agency";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "reseller_admin" | "reseller_staff";
          status: "active" | "invited" | "deactivated";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role: "reseller_admin" | "reseller_staff";
          status?: "active" | "invited" | "deactivated";
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: "reseller_admin" | "reseller_staff";
          status?: "active" | "invited" | "deactivated";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      businesses: {
        Row: {
          id: string;
          workspace_id: string;
          legal_name: string;
          trade_name: string;
          slug: string;
          gst_number: string | null;
          pan_number: string | null;
          status: "active" | "onboarding" | "suspended" | "archived";
          currency_code: string;
          sovereign_owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          legal_name: string;
          trade_name: string;
          slug: string;
          gst_number?: string | null;
          pan_number?: string | null;
          status?: "active" | "onboarding" | "suspended" | "archived";
          currency_code?: string;
          sovereign_owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          legal_name?: string;
          trade_name?: string;
          slug?: string;
          gst_number?: string | null;
          pan_number?: string | null;
          status?: "active" | "onboarding" | "suspended" | "archived";
          currency_code?: string;
          sovereign_owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "businesses_sovereign_owner_id_fkey";
            columns: ["sovereign_owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      locations: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          slug: string;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string;
          postal_code: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          slug: string;
          address_line1: string;
          address_line2?: string | null;
          city: string;
          state: string;
          postal_code: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          slug?: string;
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          state?: string;
          postal_code?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: "owner" | "manager" | "cashier" | "staff";
          location_id: string | null;
          permissions: Json;
          status: "active" | "invited" | "deactivated";
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role: "owner" | "manager" | "cashier" | "staff";
          location_id?: string | null;
          permissions?: Json;
          status?: "active" | "invited" | "deactivated";
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: "owner" | "manager" | "cashier" | "staff";
          location_id?: string | null;
          permissions?: Json;
          status?: "active" | "invited" | "deactivated";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_members_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };

      sites: {
        Row: {
          id: string;
          business_id: string;
          primary_domain: string | null;
          subdomain: string;
          published_version_id: string | null;
          status: "draft" | "published" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          primary_domain?: string | null;
          subdomain: string;
          published_version_id?: string | null;
          status?: "draft" | "published" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          primary_domain?: string | null;
          subdomain?: string;
          published_version_id?: string | null;
          status?: "draft" | "published" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      catalogue_items: {
        Row: {
          id: string;
          business_id: string;
          location_id: string | null;
          title: string;
          description: string | null;
          price_minor: number;
          currency_code: string;
          tax_rate_id: string | null;
          sku: string | null;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          location_id?: string | null;
          title: string;
          description?: string | null;
          price_minor: number;
          currency_code?: string;
          tax_rate_id?: string | null;
          sku?: string | null;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          location_id?: string | null;
          title?: string;
          description?: string | null;
          price_minor?: number;
          currency_code?: string;
          tax_rate_id?: string | null;
          sku?: string | null;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalogue_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      orders: {
        Row: {
          id: string;
          business_id: string;
          location_id: string;
          customer_id: string | null;
          order_number: string;
          status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
          total_minor: number;
          payment_status: "pending" | "claimed" | "received" | "paid" | "failed" | "refunded";
          currency_code: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          location_id: string;
          customer_id?: string | null;
          order_number: string;
          status?: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
          total_minor: number;
          payment_status?: "pending" | "claimed" | "received" | "paid" | "failed" | "refunded";
          currency_code?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          location_id?: string;
          customer_id?: string | null;
          order_number?: string;
          status?: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
          total_minor?: number;
          payment_status?: "pending" | "claimed" | "received" | "paid" | "failed" | "refunded";
          currency_code?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };

      customers: {
        Row: {
          id: string;
          business_id: string;
          full_name: string;
          phone_number: string;
          email: string | null;
          total_spend_minor: number;
          visits_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          full_name: string;
          phone_number: string;
          email?: string | null;
          total_spend_minor?: number;
          visits_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          full_name?: string;
          phone_number?: string;
          email?: string | null;
          total_spend_minor?: number;
          visits_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      invoice_sequences: {
        Row: {
          id: string;
          business_id: string;
          financial_year: string;
          series_prefix: string;
          current_sequence_number: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          financial_year: string;
          series_prefix?: string;
          current_sequence_number?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          financial_year?: string;
          series_prefix?: string;
          current_sequence_number?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      bills: {
        Row: {
          id: string;
          business_id: string;
          location_id: string;
          customer_id: string | null;
          invoice_number: string;
          financial_year: string;
          amount_minor: number;
          tax_minor: number;
          total_minor: number;
          currency_code: string;
          status: "draft" | "issued" | "paid" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          location_id: string;
          customer_id?: string | null;
          invoice_number: string;
          financial_year: string;
          amount_minor: number;
          tax_minor: number;
          total_minor: number;
          currency_code?: string;
          status?: "draft" | "issued" | "paid" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          location_id?: string;
          customer_id?: string | null;
          invoice_number?: string;
          financial_year?: string;
          amount_minor?: number;
          tax_minor?: number;
          total_minor?: number;
          currency_code?: string;
          status?: "draft" | "issued" | "paid" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bills_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      audit_logs: {
        Row: {
          id: string;
          business_id: string | null;
          workspace_id: string | null;
          user_id: string | null;
          action: string;
          resource: string;
          metadata_json: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id?: string | null;
          workspace_id?: string | null;
          user_id?: string | null;
          action: string;
          resource: string;
          metadata_json?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string | null;
          workspace_id?: string | null;
          user_id?: string | null;
          action?: string;
          resource?: string;
          metadata_json?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
