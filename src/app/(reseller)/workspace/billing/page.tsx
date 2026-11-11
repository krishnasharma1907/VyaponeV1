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
  title: "Wholesale Billing — Reseller Workspace | VyapOne",
  description: "Wholesale invoices, revenue share, and payout schedules.",
};

export default function ResellerBillingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          Wholesale Billing &amp; Payouts
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Review monthly wholesale platform invoices and split settlement credits.
        </p>
      </header>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Recent Settlement Statements</CardTitle>
          <CardDescription>Automated monthly Razorpay/Cashfree split payouts</CardDescription>
        </CardHeader>
        <CardContent>
          <TableContainer aria-label="Settlement statements">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Cycle</TableHead>
                  <TableHead scope="col">Active Tenants</TableHead>
                  <TableHead scope="col">Net Commission</TableHead>
                  <TableHead scope="col">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>October 2026</TableCell>
                  <TableCell>12 Stores</TableCell>
                  <TableCell>₹24,500</TableCell>
                  <TableCell>
                    <Badge variant="success">Paid</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </div>
  );
}
