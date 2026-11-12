import type { Database } from "@/lib/supabase/types";

export type TableRow<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/**
 * Deterministic sequence generator for stable, unique test identifiers.
 */
let sequenceNumber = 1;

export function getNextSequence(): number {
  return sequenceNumber++;
}

export function resetFactorySequence(): void {
  sequenceNumber = 1;
}

export function formatDeterministicId(prefix: string, seq?: number): string {
  const num = seq ?? getNextSequence();
  return `${prefix}_${num.toString().padStart(4, "0")}`;
}

export const BASE_TEST_TIMESTAMP = "2026-11-01T10:00:00.000Z";
