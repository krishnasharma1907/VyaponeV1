/**
 * VyapOne — In-App Notifications Types [VO-028]
 *
 * Defines notification categories, payloads, filters, and action contracts.
 */

export type NotificationType =
  | "workspace_invitation"
  | "business_invitation"
  | "membership_change"
  | "role_updated"
  | "member_removed"
  | "capacity_warning"
  | "site_status_changed"
  | "security_alert"
  | "system_announcement";

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  workspaceId: string | null;
  businessId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  workspaceId?: string | null;
  businessId?: string | null;
  data?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
}

export interface NotificationFilterOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  workspaceId?: string | null;
  businessId?: string | null;
}

export interface NotificationListResult {
  notifications: NotificationItem[];
  totalCount: number;
  unreadCount: number;
}
