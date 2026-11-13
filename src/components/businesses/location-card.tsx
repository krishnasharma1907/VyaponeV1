"use client";

import React from "react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import type { LocationRow } from "@/lib/businesses/types";

interface LocationCardProps {
  location: LocationRow;
  canEdit?: boolean;
  onEdit?: (location: LocationRow) => void;
  onSetPrimary?: (locationId: string) => void;
  isPending?: boolean;
}

export function LocationCard({
  location,
  canEdit = false,
  onEdit,
  onSetPrimary,
  isPending = false,
}: LocationCardProps) {
  const addressParts = [
    location.address_line1,
    location.address_line2,
    `${location.city}, ${location.state} — ${location.postal_code}`,
  ].filter(Boolean);

  return (
    <Card variant="default">
      <CardContent>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "var(--space-2)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: "var(--space-1)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "var(--font-size-h3)",
                  color: "var(--color-text-primary)",
                  fontWeight: 600,
                }}
              >
                {location.name}
              </h3>
              {location.is_primary && <Badge variant="primary">PRIMARY STORE</Badge>}
            </div>
            <address
              style={{
                fontStyle: "normal",
                color: "var(--color-text-secondary)",
                fontSize: "var(--font-size-body-sm)",
                lineHeight: 1.5,
              }}
            >
              {addressParts.map((part, idx) => (
                <div key={idx}>{part}</div>
              ))}
            </address>
          </div>

          {canEdit && (
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {!location.is_primary && onSetPrimary && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onSetPrimary(location.id)}
                  disabled={isPending}
                >
                  Set as Primary
                </Button>
              )}
              {onEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(location)}
                  disabled={isPending}
                >
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
