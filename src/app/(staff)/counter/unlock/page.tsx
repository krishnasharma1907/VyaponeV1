import React from "react";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Field,
  Input,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Station PIN Lock — Staff Counter | VyapOne",
  description: "Enter your 4-digit staff PIN to unlock this counter terminal.",
};

export default function StaffCounterUnlockPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "var(--space-8) auto" }}>
      <Card variant="elevated">
        <CardHeader style={{ textAlign: "center" }}>
          <CardTitle as="h1">Unlock Counter Terminal</CardTitle>
          <CardDescription>Enter staff PIN to start punching bills</CardDescription>
        </CardHeader>
        <CardContent>
          <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field id="counter-pin" label="4-Digit Staff PIN" required>
              <Input
                type="password"
                maxLength={6}
                placeholder="&bull;&bull;&bull;&bull;"
                style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5rem" }}
              />
            </Field>
            <Button type="button" variant="primary" style={{ width: "100%" }}>
              Unlock Station
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
