import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessProfileForm } from "@/components/businesses/business-profile-form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field,
  Input,
  Button,
} from "@/components/ui";
import type { BusinessRow } from "@/lib/businesses/types";

export const metadata: Metadata = {
  title: "Business Settings — Business Owner | VyapOne",
  description:
    "Business profile, GSTIN, UPI VPAs, timings, contacts, address, and confirmed merchant facts.",
};

const defaultBusiness: BusinessRow = {
  id: "00000000-0000-0000-0000-000000000001",
  workspace_id: null,
  trade_name: "Sharma Kirana & Sweets",
  legal_name: "Sharma Enterprises Private Limited",
  slug: "sharma-kirana-sweets",
  category: "grocery",
  niche_id: null,
  description: "Kirana store and daily essentials operating in Bengaluru.",
  gst_number: "29AAAAA0000A1Z5",
  pan_number: "AAAAA0000A",
  tax_scheme: "registered",
  status: "active",
  currency_code: "INR",
  preferred_language: "en",
  timezone: "Asia/Kolkata",
  contact_configuration: {
    primary_phone: "+919876543210",
    secondary_phone: null,
    whatsapp_number: "+919876543210",
    email: "contact@sharmastore.in",
    website: "https://sharma.vyapone.in",
  },
  address_configuration: {
    address_line1: "100 MG Road",
    address_line2: "Near Metro Station",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    country: "India",
  },
  timings_configuration: {
    monday: { open: "08:00", close: "22:00", closed: false },
    tuesday: { open: "08:00", close: "22:00", closed: false },
    wednesday: { open: "08:00", close: "22:00", closed: false },
    thursday: { open: "08:00", close: "22:00", closed: false },
    friday: { open: "08:00", close: "22:00", closed: false },
    saturday: { open: "08:00", close: "22:00", closed: false },
    sunday: { open: "09:00", close: "21:00", closed: false },
  },
  facts_provenance: {
    trade_name: {
      confirmed: true,
      source: "user_confirmed",
      confirmed_at: "2026-11-13T00:00:00.000Z",
    },
    gst_number: { confirmed: true, source: "gst_portal", confirmed_at: "2026-11-13T00:00:00.000Z" },
    pan_number: {
      confirmed: true,
      source: "user_confirmed",
      confirmed_at: "2026-11-13T00:00:00.000Z",
    },
    registered_address: {
      confirmed: true,
      source: "user_confirmed",
      confirmed_at: "2026-11-13T00:00:00.000Z",
    },
    primary_contact: { confirmed: false, source: "unverified" },
    operating_timings: { confirmed: false, source: "ai_extracted" },
  },
  sovereign_owner_id: "00000000-0000-0000-0000-000000000002",
  created_at: "2026-11-13T00:00:00.000Z",
  updated_at: "2026-11-13T00:00:00.000Z",
};

export default function OwnerSettingsPage() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "900px" }}
    >
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          Business &amp; Statutory Settings
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Manage sovereign merchant facts, verified GST identity, and bank account VPAs.
        </p>
      </header>

      {/* Main Interactive Profile Settings Form */}
      <BusinessProfileForm
        business={defaultBusiness}
        currentUserRole="owner"
        isSovereignOwner={true}
      />

      {/* Merchant Bank Settlement UPI VPA Card */}
      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">UPI Settlement &amp; Bank VPAs</CardTitle>
          <CardDescription>
            Direct merchant bank account VPA handles for instant customer settlements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Field
              id="biz-upi"
              label="UPI VPA (Direct Merchant Bank Settlement)"
              helperText="Payments settle directly to your verified bank account (Phase P8 / VO-083)"
            >
              <Input placeholder="e.g., merchant@bank" disabled />
            </Field>
          </form>
        </CardContent>
      </Card>

      {/* Primary Storefront Location Summary Card */}
      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Storefront Locations</CardTitle>
          <CardDescription>
            Physical fulfillment points, branch locations, and staff dispatch points.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text-primary)" }}>
                Primary Store: Main Store
              </p>
              <p
                style={{
                  margin: "var(--space-1) 0 0",
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--font-size-body-sm)",
                }}
              >
                100 MG Road, Bengaluru, Karnataka — 560001
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline">View Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
