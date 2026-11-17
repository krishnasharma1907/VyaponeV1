/**
 * VyapOne — Audit Logging Validation Schemas [VO-028]
 */

import { z } from "zod";

export const recordAuditEventSchema = z.object({
  action: z.string().min(1).max(100),
  resource: z.string().min(1).max(50),
  actorUserId: z.string().uuid().nullable().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  businessId: z.string().uuid().nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const listAuditLogsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  action: z.string().min(1).max(100).optional(),
  resource: z.string().min(1).max(50).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type RecordAuditEventInputSchema = z.infer<typeof recordAuditEventSchema>;
export type ListAuditLogsInputSchema = z.infer<typeof listAuditLogsSchema>;
