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
          plan: "starter" | "growth" | "pro" | "agency" | "scale";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_user_id: string;
          status?: "active" | "suspended" | "archived";
          plan?: "starter" | "growth" | "pro" | "agency" | "scale";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_user_id?: string;
          status?: "active" | "suspended" | "archived";
          plan?: "starter" | "growth" | "pro" | "agency" | "scale";
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
          role:
            | "workspace_owner"
            | "workspace_admin"
            | "workspace_member"
            | "reseller_admin"
            | "reseller_staff";
          status: "active" | "invited" | "deactivated";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role:
            | "workspace_owner"
            | "workspace_admin"
            | "workspace_member"
            | "reseller_admin"
            | "reseller_staff";
          status?: "active" | "invited" | "deactivated";
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?:
            | "workspace_owner"
            | "workspace_admin"
            | "workspace_member"
            | "reseller_admin"
            | "reseller_staff";
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

      workspace_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role:
            | "workspace_owner"
            | "workspace_admin"
            | "workspace_member"
            | "reseller_admin"
            | "reseller_staff";
          token_hash: string;
          invited_by: string;
          status: "pending" | "accepted" | "revoked" | "expired";
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          role:
            | "workspace_owner"
            | "workspace_admin"
            | "workspace_member"
            | "reseller_admin"
            | "reseller_staff";
          token_hash: string;
          invited_by: string;
          status?: "pending" | "accepted" | "revoked" | "expired";
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string;
          role?:
            | "workspace_owner"
            | "workspace_admin"
            | "workspace_member"
            | "reseller_admin"
            | "reseller_staff";
          token_hash?: string;
          invited_by?: string;
          status?: "pending" | "accepted" | "revoked" | "expired";
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      businesses: {
        Row: {
          id: string;
          workspace_id: string | null;
          legal_name: string;
          trade_name: string;
          slug: string;
          category: string | null;
          niche_id: string | null;
          description: string | null;
          gst_number: string | null;
          pan_number: string | null;
          tax_scheme: "registered" | "composition" | "unregistered" | "exempt";
          status: "active" | "onboarding" | "suspended" | "archived";
          currency_code: string;
          preferred_language: string;
          timezone: string;
          contact_configuration: Json;
          address_configuration: Json;
          timings_configuration: Json;
          facts_provenance: Json;
          sovereign_owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          legal_name: string;
          trade_name: string;
          slug: string;
          category?: string | null;
          niche_id?: string | null;
          description?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          tax_scheme?: "registered" | "composition" | "unregistered" | "exempt";
          status?: "active" | "onboarding" | "suspended" | "archived";
          currency_code?: string;
          preferred_language?: string;
          timezone?: string;
          contact_configuration?: Json;
          address_configuration?: Json;
          timings_configuration?: Json;
          facts_provenance?: Json;
          sovereign_owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          legal_name?: string;
          trade_name?: string;
          slug?: string;
          category?: string | null;
          niche_id?: string | null;
          description?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          tax_scheme?: "registered" | "composition" | "unregistered" | "exempt";
          status?: "active" | "onboarding" | "suspended" | "archived";
          currency_code?: string;
          preferred_language?: string;
          timezone?: string;
          contact_configuration?: Json;
          address_configuration?: Json;
          timings_configuration?: Json;
          facts_provenance?: Json;
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

      business_invitations: {
        Row: {
          id: string;
          business_id: string;
          email: string;
          role: "owner" | "manager" | "cashier" | "staff";
          location_id: string | null;
          permissions: Json;
          token_hash: string;
          invited_by: string;
          status: "pending" | "accepted" | "revoked" | "expired";
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          email: string;
          role: "owner" | "manager" | "cashier" | "staff";
          location_id?: string | null;
          permissions?: Json;
          token_hash: string;
          invited_by: string;
          status?: "pending" | "accepted" | "revoked" | "expired";
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          email?: string;
          role?: "owner" | "manager" | "cashier" | "staff";
          location_id?: string | null;
          permissions?: Json;
          token_hash?: string;
          invited_by?: string;
          status?: "pending" | "accepted" | "revoked" | "expired";
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_invitations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_invitations_location_id_fkey";
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
          current_draft_version_id: string | null;
          status: "draft" | "published" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          primary_domain?: string | null;
          subdomain: string;
          published_version_id?: string | null;
          current_draft_version_id?: string | null;
          status?: "draft" | "published" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          primary_domain?: string | null;
          subdomain?: string;
          published_version_id?: string | null;
          current_draft_version_id?: string | null;
          status?: "draft" | "published" | "suspended" | "archived";
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

      site_versions: {
        Row: {
          id: string;
          site_id: string;
          business_id: string;
          version_number: number;
          schema_version: string;
          configuration: Json;
          change_summary: string | null;
          created_by: string | null;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          site_id: string;
          business_id: string;
          version_number: number;
          schema_version?: string;
          configuration: Json;
          change_summary?: string | null;
          created_by?: string | null;
          created_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          site_id?: string;
          business_id?: string;
          version_number?: number;
          schema_version?: string;
          configuration?: Json;
          change_summary?: string | null;
          created_by?: string | null;
          created_at?: string;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "site_versions_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_versions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
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

      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          plan_id: string;
          status: "active" | "trialing" | "past_due" | "grace_period" | "canceled";
          current_period_start: string;
          current_period_end: string;
          grace_period_end: string | null;
          provider_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan_id: string;
          status?: "active" | "trialing" | "past_due" | "grace_period" | "canceled";
          current_period_start?: string;
          current_period_end?: string;
          grace_period_end?: string | null;
          provider_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          plan_id?: string;
          status?: "active" | "trialing" | "past_due" | "grace_period" | "canceled";
          current_period_start?: string;
          current_period_end?: string;
          grace_period_end?: string | null;
          provider_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };

      entitlement_overrides: {
        Row: {
          id: string;
          workspace_id: string | null;
          business_id: string | null;
          feature_key: string;
          is_enabled: boolean;
          expires_at: string | null;
          reason: string | null;
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          business_id?: string | null;
          feature_key: string;
          is_enabled?: boolean;
          expires_at?: string | null;
          reason?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string | null;
          business_id?: string | null;
          feature_key?: string;
          is_enabled?: boolean;
          expires_at?: string | null;
          reason?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entitlement_overrides_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlement_overrides_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      capacity_overrides: {
        Row: {
          id: string;
          workspace_id: string;
          metric: string;
          additional_capacity: number;
          expires_at: string | null;
          reason: string | null;
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          metric: string;
          additional_capacity?: number;
          expires_at?: string | null;
          reason?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          metric?: string;
          additional_capacity?: number;
          expires_at?: string | null;
          reason?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capacity_overrides_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };

      notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          workspace_id: string | null;
          business_id: string | null;
          type:
            | "workspace_invitation"
            | "business_invitation"
            | "membership_change"
            | "role_updated"
            | "member_removed"
            | "capacity_warning"
            | "site_status_changed"
            | "security_alert"
            | "system_announcement";
          title: string;
          message: string;
          data: Json;
          read: boolean;
          read_at: string | null;
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipient_user_id: string;
          workspace_id?: string | null;
          business_id?: string | null;
          type:
            | "workspace_invitation"
            | "business_invitation"
            | "membership_change"
            | "role_updated"
            | "member_removed"
            | "capacity_warning"
            | "site_status_changed"
            | "security_alert"
            | "system_announcement";
          title: string;
          message: string;
          data?: Json;
          read?: boolean;
          read_at?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipient_user_id?: string;
          workspace_id?: string | null;
          business_id?: string | null;
          type?:
            | "workspace_invitation"
            | "business_invitation"
            | "membership_change"
            | "role_updated"
            | "member_removed"
            | "capacity_warning"
            | "site_status_changed"
            | "security_alert"
            | "system_announcement";
          title?: string;
          message?: string;
          data?: Json;
          read?: boolean;
          read_at?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      niche_groups: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          display_order: number;
          status: "active" | "inactive" | "deprecated";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          display_order?: number;
          status?: "active" | "inactive" | "deprecated";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          display_order?: number;
          status?: "active" | "inactive" | "deprecated";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      niches: {
        Row: {
          id: string;
          niche_group_id: string;
          slug: string;
          name: string;
          description: string | null;
          availability_label: "live_operational" | "informational_with_enquiry" | "coming_soon";
          manifest_version: string;
          manifest: Json;
          display_order: number;
          status: "active" | "inactive" | "deprecated";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          niche_group_id: string;
          slug: string;
          name: string;
          description?: string | null;
          availability_label?: "live_operational" | "informational_with_enquiry" | "coming_soon";
          manifest_version?: string;
          manifest?: Json;
          display_order?: number;
          status?: "active" | "inactive" | "deprecated";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          niche_group_id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          availability_label?: "live_operational" | "informational_with_enquiry" | "coming_soon";
          manifest_version?: string;
          manifest?: Json;
          display_order?: number;
          status?: "active" | "inactive" | "deprecated";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "niches_niche_group_id_fkey";
            columns: ["niche_group_id"];
            isOneToOne: false;
            referencedRelation: "niche_groups";
            referencedColumns: ["id"];
          },
        ];
      };

      platform_modules: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          category: "core" | "operations" | "growth" | "compliance" | "commerce";
          entitlement_feature_key: string | null;
          status: "active" | "beta" | "coming_soon" | "deprecated";
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          category?: "core" | "operations" | "growth" | "compliance" | "commerce";
          entitlement_feature_key?: string | null;
          status?: "active" | "beta" | "coming_soon" | "deprecated";
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          description?: string | null;
          category?: "core" | "operations" | "growth" | "compliance" | "commerce";
          entitlement_feature_key?: string | null;
          status?: "active" | "beta" | "coming_soon" | "deprecated";
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      niche_modules: {
        Row: {
          id: string;
          niche_id: string;
          module_id: string;
          is_default: boolean;
          is_recommended: boolean;
          display_order: number;
          preset_config: Json;
          status: "active" | "inactive";
          created_at: string;
        };
        Insert: {
          id?: string;
          niche_id: string;
          module_id: string;
          is_default?: boolean;
          is_recommended?: boolean;
          display_order?: number;
          preset_config?: Json;
          status?: "active" | "inactive";
          created_at?: string;
        };
        Update: {
          id?: string;
          niche_id?: string;
          module_id?: string;
          is_default?: boolean;
          is_recommended?: boolean;
          display_order?: number;
          preset_config?: Json;
          status?: "active" | "inactive";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "niche_modules_niche_id_fkey";
            columns: ["niche_id"];
            isOneToOne: false;
            referencedRelation: "niches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "niche_modules_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "platform_modules";
            referencedColumns: ["id"];
          },
        ];
      };

      business_modules: {
        Row: {
          id: string;
          business_id: string;
          module_key: string;
          is_enabled: boolean;
          custom_config: Json;
          enabled_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          module_key: string;
          is_enabled?: boolean;
          custom_config?: Json;
          enabled_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          module_key?: string;
          is_enabled?: boolean;
          custom_config?: Json;
          enabled_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_modules_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_modules_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "platform_modules";
            referencedColumns: ["key"];
          },
        ];
      };

      business_onboarding_answers: {
        Row: {
          id: string;
          business_id: string;
          niche_slug: string;
          manifest_version: string;
          answers: Json;
          is_complete: boolean;
          missing_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          niche_slug: string;
          manifest_version?: string;
          answers?: Json;
          is_complete?: boolean;
          missing_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          niche_slug?: string;
          manifest_version?: string;
          answers?: Json;
          is_complete?: boolean;
          missing_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_onboarding_answers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };

      media_items: {
        Row: {
          id: string;
          business_id: string;
          workspace_id: string | null;
          uploaded_by: string;
          category:
            | "business_logo"
            | "catalogue_image"
            | "website_asset"
            | "document_attachment"
            | "onboarding_upload";
          bucket: "vyapone-public-media" | "vyapone-private-media";
          object_key: string;
          original_filename: string;
          declared_content_type: string;
          detected_content_type: string | null;
          file_size_bytes: number;
          width: number | null;
          height: number | null;
          is_public: boolean;
          status: "pending_upload" | "ready" | "failed" | "deletion_pending" | "archived";
          metadata: Json;
          expires_at: string | null;
          verified_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          workspace_id?: string | null;
          uploaded_by: string;
          category:
            | "business_logo"
            | "catalogue_image"
            | "website_asset"
            | "document_attachment"
            | "onboarding_upload";
          bucket: "vyapone-public-media" | "vyapone-private-media";
          object_key: string;
          original_filename: string;
          declared_content_type: string;
          detected_content_type?: string | null;
          file_size_bytes: number;
          width?: number | null;
          height?: number | null;
          is_public?: boolean;
          status?: "pending_upload" | "ready" | "failed" | "deletion_pending" | "archived";
          metadata?: Json;
          expires_at?: string | null;
          verified_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          workspace_id?: string | null;
          uploaded_by?: string;
          category?:
            | "business_logo"
            | "catalogue_image"
            | "website_asset"
            | "document_attachment"
            | "onboarding_upload";
          bucket?: "vyapone-public-media" | "vyapone-private-media";
          object_key?: string;
          original_filename?: string;
          declared_content_type?: string;
          detected_content_type?: string | null;
          file_size_bytes?: number;
          width?: number | null;
          height?: number | null;
          is_public?: boolean;
          status?: "pending_upload" | "ready" | "failed" | "deletion_pending" | "archived";
          metadata?: Json;
          expires_at?: string | null;
          verified_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_items_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      user_directory: {
        Row: {
          id: string;
          display_name: string;
          status: string;
          preferred_language: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      confirm_business_import_atomic: {
        Args: {
          p_workspace_id: string;
          p_caller_user_id: string;
          p_trade_name: string;
          p_legal_name?: string | null;
          p_slug?: string | null;
          p_niche_slug?: string | null;
          p_category?: string | null;
          p_description?: string | null;
          p_gst_number?: string | null;
          p_pan_number?: string | null;
          p_tax_scheme?: string | null;
          p_contact?: Json | null;
          p_location_name?: string | null;
          p_address_line1: string;
          p_address_line2?: string | null;
          p_city: string;
          p_state: string;
          p_postal_code: string;
          p_timings_answers?: Json | null;
          p_import_proposal_id?: string | null;
          p_source_format?: string | null;
          p_source_file_name?: string | null;
          p_default_modules?: string[] | null;
          p_catalogue_items?: Json | null;
          p_reviewed_fields_count?: number | null;
        };
        Returns: Json;
      };
      create_business_with_setup_atomic: {
        Args: {
          p_workspace_id: string;
          p_caller_user_id: string;
          p_trade_name: string;
          p_legal_name: string;
          p_slug: string;
          p_niche_slug: string;
          p_category?: string | null;
          p_description?: string | null;
          p_gst_number?: string | null;
          p_pan_number?: string | null;
          p_tax_scheme?: string | null;
          p_contact?: Json | null;
          p_location_name?: string | null;
          p_address_line1: string;
          p_address_line2?: string | null;
          p_city: string;
          p_state: string;
          p_postal_code: string;
          p_logo_media_id?: string | null;
          p_showcase_media_ids?: string[] | null;
          p_manifest_version?: string | null;
          p_sanitized_answers?: Json | null;
          p_is_onboarding_complete?: boolean | null;
          p_missing_fields?: Json | null;
          p_default_modules?: string[] | null;
        };
        Returns: Json;
      };
      create_business_with_primary_location: {
        Args: {
          p_legal_name: string;
          p_trade_name: string;
          p_slug: string;
          p_location_name: string;
          p_address_line1: string;
          p_city: string;
          p_state: string;
          p_postal_code: string;
          p_workspace_id?: string | null;
          p_gst_number?: string | null;
          p_pan_number?: string | null;
          p_address_line2?: string | null;
        };
        Returns: Json;
      };
      is_workspace_member: {
        Args: {
          p_workspace_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_workspace_admin_or_owner: {
        Args: {
          p_workspace_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_business_sovereign_owner: {
        Args: {
          p_business_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_business_member: {
        Args: {
          p_business_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      is_business_owner_or_manager: {
        Args: {
          p_business_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      can_access_business: {
        Args: {
          p_business_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      can_manage_business: {
        Args: {
          p_business_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      can_access_location: {
        Args: {
          p_location_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      ensure_user_profile: {
        Args: {
          p_display_name?: string | null;
          p_preferred_language?: string | null;
        };
        Returns: Json;
      };
      assert_and_lock_workspace_capacity: {
        Args: {
          p_workspace_id: string;
          p_metric: string;
          p_requested_quantity?: number;
        };
        Returns: {
          allowed: boolean;
          current_count: number;
          effective_limit: number;
          remaining: number;
          reason: string;
        }[];
      };
      transition_site_status_atomic: {
        Args: {
          p_site_id: string;
          p_target_status: string;
        };
        Returns: {
          success: boolean;
          status: string;
          reason: string;
        }[];
      };
      accept_workspace_invitation_atomic: {
        Args: {
          p_token_hash: string;
          p_accepting_user_id: string;
          p_accepting_user_email: string;
        };
        Returns: Json;
      };
      accept_business_invitation_atomic: {
        Args: {
          p_token_hash: string;
          p_accepting_user_id: string;
          p_accepting_user_email: string;
        };
        Returns: Json;
      };
      is_business_manager_or_owner: {
        Args: {
          p_business_id: string;
          p_user_id?: string;
        };
        Returns: boolean;
      };
      create_in_app_notification: {
        Args: {
          p_recipient_user_id: string;
          p_type: string;
          p_title: string;
          p_message: string;
          p_data?: Json;
          p_workspace_id?: string | null;
          p_business_id?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: string;
      };
      save_site_draft_configuration_atomic: {
        Args: {
          p_site_id: string;
          p_business_id: string;
          p_caller_user_id: string;
          p_schema_version: string;
          p_configuration: Json;
          p_change_summary?: string | null;
          p_referenced_media_ids?: string[] | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
