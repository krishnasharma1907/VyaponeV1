import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import {
  createNotification,
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications/service";
import {
  getUnreadNotificationCountAction,
  listNotificationsAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/lib/notifications/actions";
import { TenantAccessError } from "@/lib/auth/tenant-access";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock tenant-access helpers
const mockAssertAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/tenant-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/tenant-access")>();
  return {
    ...actual,
    assertAuthenticatedUser: (...args: unknown[]) => mockAssertAuthenticatedUser(...args),
  };
});

// Mock Supabase server client for Server Actions
const mockServerSupabase: {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
} = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => mockServerSupabase),
}));

describe("VO-028 Notifications Service Unit Tests", () => {
  const mockUserId = "usr-111";
  const mockNotificationId = "notif-001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotification", () => {
    it("calls create_in_app_notification RPC and returns typed NotificationItem", async () => {
      const mockRecord = {
        id: mockNotificationId,
        recipient_user_id: mockUserId,
        workspace_id: "ws-1",
        business_id: null,
        type: "workspace_invitation",
        title: "Workspace Invitation",
        message: "You have been invited to join Workspace Alpha",
        data: { role: "workspace_admin" },
        read: false,
        read_at: null,
        idempotency_key: "idem-key-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockRpc = vi.fn().mockResolvedValue({
        data: mockNotificationId,
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockRecord,
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = {
        rpc: mockRpc,
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      const item = await createNotification(mockSupabase, {
        recipientUserId: mockUserId,
        type: "workspace_invitation",
        title: "Workspace Invitation",
        message: "You have been invited to join Workspace Alpha",
        workspaceId: "ws-1",
        data: { role: "workspace_admin" },
        idempotencyKey: "idem-key-123",
      });

      expect(mockRpc).toHaveBeenCalledWith("create_in_app_notification", {
        p_recipient_user_id: mockUserId,
        p_type: "workspace_invitation",
        p_title: "Workspace Invitation",
        p_message: "You have been invited to join Workspace Alpha",
        p_data: { role: "workspace_admin" },
        p_workspace_id: "ws-1",
        p_business_id: null,
        p_idempotency_key: "idem-key-123",
      });

      expect(item.id).toBe(mockNotificationId);
      expect(item.type).toBe("workspace_invitation");
      expect(item.read).toBe(false);
      expect(item.idempotencyKey).toBe("idem-key-123");
    });

    it("throws error when RPC invocation fails", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Recipient user not found" },
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as SupabaseClient<Database>;

      await expect(
        createNotification(mockSupabase, {
          recipientUserId: "non-existent-user",
          type: "system_announcement",
          title: "Maintenance",
          message: "Scheduled downtime tonight",
        }),
      ).rejects.toThrow("Failed to create notification: Recipient user not found");
    });
  });

  describe("listUserNotifications", () => {
    it("enforces recipient isolation and queries only caller's notifications", async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [
          {
            id: "notif-1",
            recipient_user_id: mockUserId,
            workspace_id: null,
            business_id: null,
            type: "security_alert",
            title: "New Login",
            message: "New login detected from a new device",
            data: {},
            read: false,
            read_at: null,
            idempotency_key: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        count: 1,
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEqNotifications = vi.fn().mockReturnValue({ order: mockOrder });

      // Unread count sub-query
      const mockEqUnreadSecond = vi.fn().mockResolvedValue({ count: 1, error: null });
      const mockEqUnreadFirst = vi.fn().mockReturnValue({ eq: mockEqUnreadSecond });

      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({ eq: mockEqNotifications }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({ eq: mockEqUnreadFirst }),
        };
      });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      const result = await listUserNotifications(mockSupabase, mockUserId);

      expect(mockEqNotifications).toHaveBeenCalledWith("recipient_user_id", mockUserId);
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].id).toBe("notif-1");
      expect(result.totalCount).toBe(1);
      expect(result.unreadCount).toBe(1);
    });
  });

  describe("getUnreadNotificationCount", () => {
    it("counts unread notifications for user", async () => {
      const mockEqRead = vi.fn().mockResolvedValue({ count: 4, error: null });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqRead });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

      const count = await getUnreadNotificationCount(mockSupabase, mockUserId);

      expect(mockEqUser).toHaveBeenCalledWith("recipient_user_id", mockUserId);
      expect(mockEqRead).toHaveBeenCalledWith("read", false);
      expect(count).toBe(4);
    });
  });

  describe("markNotificationAsRead", () => {
    it("updates notification with read = true and read_at timestamp", async () => {
      const now = new Date().toISOString();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: {
          id: mockNotificationId,
          recipient_user_id: mockUserId,
          workspace_id: null,
          business_id: null,
          type: "site_status_changed",
          title: "Site Published",
          message: "Your site is now live",
          data: {},
          read: true,
          read_at: now,
          idempotency_key: null,
          created_at: now,
          updated_at: now,
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqUser = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      const mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

      const item = await markNotificationAsRead(mockSupabase, mockNotificationId, mockUserId);

      expect(mockEqId).toHaveBeenCalledWith("id", mockNotificationId);
      expect(mockEqUser).toHaveBeenCalledWith("recipient_user_id", mockUserId);
      expect(item.read).toBe(true);
    });

    it("throws NOT_FOUND if notification belongs to another user or does not exist", async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqUser = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      const mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

      await expect(
        markNotificationAsRead(mockSupabase, "foreign-notif-id", mockUserId),
      ).rejects.toThrow("Notification not found");
    });
  });

  describe("markAllNotificationsAsRead", () => {
    it("batch updates all unread notifications for recipient", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "n1" }, { id: "n2" }],
        error: null,
      });
      const mockEqRead = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqRead });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUser });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      const mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

      const res = await markAllNotificationsAsRead(mockSupabase, mockUserId);

      expect(mockEqUser).toHaveBeenCalledWith("recipient_user_id", mockUserId);
      expect(mockEqRead).toHaveBeenCalledWith("read", false);
      expect(res.updatedCount).toBe(2);
    });
  });

  describe("Server Actions", () => {
    it("listNotificationsAction rejects unauthenticated callers", async () => {
      mockAssertAuthenticatedUser.mockRejectedValueOnce(
        new TenantAccessError("Authentication required", "UNAUTHENTICATED", 401),
      );

      const res = await listNotificationsAction();

      expect(res.success).toBe(false);
      expect(res.code).toBe("UNAUTHENTICATED");
      expect(res.statusCode).toBe(401);
    });

    it("markNotificationAsReadAction marks notification for session user", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });

      const now = new Date().toISOString();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: {
          id: mockNotificationId,
          recipient_user_id: mockUserId,
          workspace_id: null,
          business_id: null,
          type: "system_announcement",
          title: "Welcome",
          message: "Welcome to VyapOne",
          data: {},
          read: true,
          read_at: now,
          idempotency_key: null,
          created_at: now,
          updated_at: now,
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqUser = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });
      mockServerSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await markNotificationAsReadAction({
        notificationId: "11111111-1111-4111-a111-111111111111",
      });

      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.read).toBe(true);
      }
    });

    it("getUnreadNotificationCountAction returns unread count for session user", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });

      const mockEqRead = vi.fn().mockResolvedValue({ count: 3, error: null });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqRead });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });
      mockServerSupabase.from.mockReturnValue({ select: mockSelect });

      const res = await getUnreadNotificationCountAction();

      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.unreadCount).toBe(3);
      }
    });

    it("markAllNotificationsAsReadAction marks all notifications for session user", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
        error: null,
      });
      const mockEqRead = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqRead });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUser });
      mockServerSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await markAllNotificationsAsReadAction();

      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.updatedCount).toBe(3);
      }
    });
  });
});
