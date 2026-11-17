/**
 * VyapOne — In-App Notifications Service [VO-028]
 *
 * Provides transactional, recipient-isolated notification management.
 * Invariants:
 * 1. Notifications are created via trusted stored procedures or service clients.
 * 2. Strict recipient isolation: Users can only query and mutate their own notifications.
 * 3. Idempotent delivery prevents duplicate notifications across retries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type {
  CreateNotificationInput,
  NotificationFilterOptions,
  NotificationItem,
  NotificationListResult,
  NotificationType,
} from "./types";

function mapNotificationRow(row: {
  id: string;
  recipient_user_id: string;
  workspace_id: string | null;
  business_id: string | null;
  type: string;
  title: string;
  message: string;
  data: Json | unknown;
  read: boolean;
  read_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}): NotificationItem {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    workspaceId: row.workspace_id,
    businessId: row.business_id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    data: (row.data as Record<string, unknown>) ?? {},
    read: row.read,
    readAt: row.read_at,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Creates an in-app notification using the trusted PostgreSQL stored procedure.
 * Guarantees idempotency when an idempotencyKey is supplied.
 */
export async function createNotification(
  supabase: SupabaseClient<Database>,
  input: CreateNotificationInput,
): Promise<NotificationItem> {
  // Use privileged service_role client to execute create_in_app_notification RPC
  let executionClient = supabase;
  try {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
    executionClient = createAdminSupabaseClient();
  } catch {
    executionClient = supabase;
  }

  const { data: notificationId, error } = await executionClient.rpc("create_in_app_notification", {
    p_recipient_user_id: input.recipientUserId,
    p_type: input.type,
    p_title: input.title,
    p_message: input.message,
    p_data: (input.data ?? {}) as Json,
    p_workspace_id: input.workspaceId ?? null,
    p_business_id: input.businessId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error || !notificationId) {
    throw new Error(`Failed to create notification: ${error?.message ?? "unknown error"}`);
  }

  const { data: record, error: fetchError } = await executionClient
    .from("notifications")
    .select("*")
    .eq("id", notificationId as string)
    .single();

  if (fetchError || !record) {
    throw new Error(
      `Failed to retrieve created notification: ${fetchError?.message ?? "not found"}`,
    );
  }

  return mapNotificationRow(record);
}

/**
 * Fetches notifications for a specific user with pagination and optional unread/tenant filtering.
 * Enforces recipient isolation at query level.
 */
export async function listUserNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: NotificationFilterOptions,
): Promise<NotificationListResult> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("recipient_user_id", userId);

  if (options?.unreadOnly) {
    query = query.eq("read", false);
  }
  if (options?.workspaceId) {
    query = query.eq("workspace_id", options.workspaceId);
  }
  if (options?.businessId) {
    query = query.eq("business_id", options.businessId);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  // Count unread notifications for this user
  let unreadQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("read", false);

  if (options?.workspaceId) {
    unreadQuery = unreadQuery.eq("workspace_id", options.workspaceId);
  }
  if (options?.businessId) {
    unreadQuery = unreadQuery.eq("business_id", options.businessId);
  }

  const { count: unreadCount, error: unreadError } = await unreadQuery;
  if (unreadError) {
    throw new Error(`Failed to count unread notifications: ${unreadError.message}`);
  }

  return {
    notifications: (data ?? []).map(mapNotificationRow),
    totalCount: count ?? 0,
    unreadCount: unreadCount ?? 0,
  };
}

/**
 * Returns the count of unread notifications for a user.
 */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient<Database>,
  userId: string,
  filter?: { workspaceId?: string; businessId?: string },
): Promise<number> {
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("read", false);

  if (filter?.workspaceId) {
    query = query.eq("workspace_id", filter.workspaceId);
  }
  if (filter?.businessId) {
    query = query.eq("business_id", filter.businessId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count unread notifications: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Marks a single notification as read.
 * Enforces recipient ownership: returns NOT_FOUND if notification does not belong to caller.
 */
export async function markNotificationAsRead(
  supabase: SupabaseClient<Database>,
  notificationId: string,
  userId: string,
): Promise<NotificationItem> {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("recipient_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  if (!data) {
    throw new Error("Notification not found");
  }

  return mapNotificationRow(data);
}

/**
 * Marks all unread notifications as read for the user, with optional workspace or business scope.
 */
export async function markAllNotificationsAsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  filter?: { workspaceId?: string; businessId?: string },
): Promise<{ updatedCount: number }> {
  let query = supabase
    .from("notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_user_id", userId)
    .eq("read", false);

  if (filter?.workspaceId) {
    query = query.eq("workspace_id", filter.workspaceId);
  }
  if (filter?.businessId) {
    query = query.eq("business_id", filter.businessId);
  }

  const { data, error } = await query.select("id");

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }

  return {
    updatedCount: data ? data.length : 0,
  };
}
