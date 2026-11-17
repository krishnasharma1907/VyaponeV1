"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertAuthenticatedUser,
  sanitizeTenantError,
  TenantAccessError,
} from "@/lib/auth/tenant-access";
import {
  listNotificationsSchema,
  markAllNotificationsAsReadSchema,
  markNotificationAsReadSchema,
} from "./schemas";
import {
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./service";
import type { NotificationItem, NotificationListResult } from "./types";

export interface NotificationActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  statusCode?: number;
}

function handleNotificationActionError(err: unknown): NotificationActionResult<never> {
  if (err instanceof TenantAccessError) {
    const sanitized = sanitizeTenantError(err);
    return {
      success: false,
      error: sanitized.error,
      code: sanitized.code,
      statusCode: sanitized.status,
    };
  }
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  return {
    success: false,
    error: message,
    code: "NOTIFICATION_ACTION_FAILED",
    statusCode: 500,
  };
}

/**
 * Server Action to list notifications for the currently authenticated user.
 */
export async function listNotificationsAction(
  options?: unknown,
): Promise<NotificationActionResult<NotificationListResult>> {
  try {
    const parsedOptions = options ? listNotificationsSchema.parse(options) : undefined;
    const supabase = await createServerSupabaseClient();
    const user = await assertAuthenticatedUser(supabase);

    const result = await listUserNotifications(supabase, user.id, parsedOptions);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleNotificationActionError(err);
  }
}

/**
 * Server Action to get the unread notifications count for the authenticated user.
 */
export async function getUnreadNotificationCountAction(
  filter?: unknown,
): Promise<NotificationActionResult<{ unreadCount: number }>> {
  try {
    const parsedFilter = filter ? markAllNotificationsAsReadSchema.parse(filter) : undefined;
    const supabase = await createServerSupabaseClient();
    const user = await assertAuthenticatedUser(supabase);

    const count = await getUnreadNotificationCount(supabase, user.id, parsedFilter);
    return {
      success: true,
      data: { unreadCount: count },
    };
  } catch (err) {
    return handleNotificationActionError(err);
  }
}

/**
 * Server Action to mark a notification as read.
 */
export async function markNotificationAsReadAction(
  input: unknown,
): Promise<NotificationActionResult<NotificationItem>> {
  try {
    const { notificationId } = markNotificationAsReadSchema.parse(input);
    const supabase = await createServerSupabaseClient();
    const user = await assertAuthenticatedUser(supabase);

    const updated = await markNotificationAsRead(supabase, notificationId, user.id);
    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    return handleNotificationActionError(err);
  }
}

/**
 * Server Action to mark all notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsReadAction(
  input?: unknown,
): Promise<NotificationActionResult<{ updatedCount: number }>> {
  try {
    const parsedFilter = input ? markAllNotificationsAsReadSchema.parse(input) : undefined;
    const supabase = await createServerSupabaseClient();
    const user = await assertAuthenticatedUser(supabase);

    const result = await markAllNotificationsAsRead(supabase, user.id, parsedFilter);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleNotificationActionError(err);
  }
}
