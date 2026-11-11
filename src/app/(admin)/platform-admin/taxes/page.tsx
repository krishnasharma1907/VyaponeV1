import React from "react";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableContainer,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "GST Master Tables — Platform Administration | VyapOne",
  description: "Statutory HSN/SAC code GST rate tables per Indian GST Council schedules.",
};

export default function AdminTaxesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-1)",
          }}
        >
          <h1 style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-primary)" }}>
            Statutory GST Rate Master Tables
          </h1>
          <Badge variant="info">Statutory Reference Schedule</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Server-owned master statutory tables. AI assistants and client code must never invent or
          calculate GST rates independently (Master DB sync in VO-081).
        </p>
      </header>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Standard GST Rate Slabs</CardTitle>
          <CardDescription>
            Canonical tax rates applicable across supported business niches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableContainer aria-label="Statutory GST Tax Slabs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Rate Slab</TableHead>
                  <TableHead scope="col">CGST Rate</TableHead>
                  <TableHead scope="col">SGST Rate</TableHead>
                  <TableHead scope="col">IGST Rate</TableHead>
                  <TableHead scope="col">Applicable Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>0% (Exempt)</TableCell>
                  <TableCell>0.0%</TableCell>
                  <TableCell>0.0%</TableCell>
                  <TableCell>0.0%</TableCell>
                  <TableCell>Fresh grains, unprocessed vegetables, milk</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>5%</TableCell>
                  <TableCell>2.5%</TableCell>
                  <TableCell>2.5%</TableCell>
                  <TableCell>5.0%</TableCell>
                  <TableCell>Packaged food items, apparel &le; ₹1,000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>12%</TableCell>
                  <TableCell>6.0%</TableCell>
                  <TableCell>6.0%</TableCell>
                  <TableCell>12.0%</TableCell>
                  <TableCell>Processed food, business stationery</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>18%</TableCell>
                  <TableCell>9.0%</TableCell>
                  <TableCell>9.0%</TableCell>
                  <TableCell>18.0%</TableCell>
                  <TableCell>Standard services, salon &amp; wellness, SaaS</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>28%</TableCell>
                  <TableCell>14.0%</TableCell>
                  <TableCell>14.0%</TableCell>
                  <TableCell>28.0%</TableCell>
                  <TableCell>Automotive parts, luxury goods</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </div>
  );
}
