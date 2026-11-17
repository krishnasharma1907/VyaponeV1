/**
 * VyapOne — In-App Notifications Validation Schemas [VO-028]
 */

import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "workspace_invitation",
  "business_invitation",
  "membership_change",
  "role_updated",
  "member_removed",
  "capacity_warning",
  "site_status_changed",
  "security_alert",
  "system_announcement",
]);

export const createNotificationSchema = z.object({
  recipientUserId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  workspaceId: z.string().uuid().nullable().optional(),
  businessId: z.string().uuid().nullable().optional(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  idempotencyKey: z.string().max(128).nullable().optional(),
});

export const listNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  unreadOnly: z.boolean().default(false),
  workspaceId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
});

export const markNotificationAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export const markAllNotificationsAsReadSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
});

export type CreateNotificationSchema = z.infer<typeof createNotificationSchema>;
export type ListNotificationsSchema = z.infer<typeof listNotificationsSchema>;
export type MarkNotificationAsReadSchema = z.infer<typeof markNotificationAsReadSchema>;
export type MarkAllNotificationsAsReadSchema = z.infer<typeof markAllNotificationsAsReadSchema>;
