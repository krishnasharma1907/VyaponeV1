import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import type { NotificationItem } from "@/lib/notifications/types";

// Mock server actions called by component
const mockListNotificationsAction = vi.fn();
const mockGetUnreadCountAction = vi.fn();
const mockMarkReadAction = vi.fn();
const mockMarkAllReadAction = vi.fn();

vi.mock("@/lib/notifications/actions", () => ({
  listNotificationsAction: (...args: unknown[]) => mockListNotificationsAction(...args),
  getUnreadNotificationCountAction: (...args: unknown[]) => mockGetUnreadCountAction(...args),
  markNotificationAsReadAction: (...args: unknown[]) => mockMarkReadAction(...args),
  markAllNotificationsAsReadAction: (...args: unknown[]) => mockMarkAllReadAction(...args),
}));

describe("VO-028 NotificationCenter UI Component", () => {
  const sampleNotifications: NotificationItem[] = [
    {
      id: "n-1",
      recipientUserId: "u-1",
      workspaceId: "ws-1",
      businessId: null,
      type: "workspace_invitation",
      title: "Team Invite",
      message: "You were invited to Workspace Alpha",
      data: {},
      read: false,
      readAt: null,
      idempotencyKey: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "n-2",
      recipientUserId: "u-1",
      workspaceId: null,
      businessId: "biz-1",
      type: "site_status_changed",
      title: "Website Published",
      message: "Your site 'My Store' is live",
      data: {},
      read: true,
      readAt: new Date().toISOString(),
      idempotencyKey: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell trigger button with unread count badge when unread > 0", () => {
    render(
      <NotificationCenter initialNotifications={sampleNotifications} initialUnreadCount={1} />,
    );

    const trigger = screen.getByTestId("notification-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-label")).toBe("Notifications, 1 unread");

    const badge = screen.getByTestId("notification-badge");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("1");
  });

  it("does not render unread badge when unread count is 0", () => {
    render(
      <NotificationCenter initialNotifications={[sampleNotifications[1]]} initialUnreadCount={0} />,
    );

    expect(screen.queryByTestId("notification-badge")).toBeNull();
  });

  it("opens dropdown panel on click and closes on subsequent click", () => {
    render(
      <NotificationCenter initialNotifications={sampleNotifications} initialUnreadCount={1} />,
    );

    const trigger = screen.getByTestId("notification-trigger");
    expect(screen.queryByTestId("notification-panel")).toBeNull();

    // Open
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.getByTestId("notification-panel")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // Close
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.queryByTestId("notification-panel")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes dropdown panel when Escape key is pressed", () => {
    render(
      <NotificationCenter initialNotifications={sampleNotifications} initialUnreadCount={1} />,
    );

    const trigger = screen.getByTestId("notification-trigger");
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.getByTestId("notification-panel")).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByTestId("notification-panel")).toBeNull();
  });

  it("displays notification items with category badge, title, and relative time", () => {
    render(
      <NotificationCenter initialNotifications={sampleNotifications} initialUnreadCount={1} />,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("notification-trigger"));
    });

    expect(screen.getByText("Team Invite")).toBeTruthy();
    expect(screen.getByText("You were invited to Workspace Alpha")).toBeTruthy();
    expect(screen.getByText("Website Published")).toBeTruthy();
    expect(screen.getByText("Invitation")).toBeTruthy();
    expect(screen.getByText("Website")).toBeTruthy();
  });

  it("filters notifications when switching between All and Unread tabs", () => {
    render(
      <NotificationCenter initialNotifications={sampleNotifications} initialUnreadCount={1} />,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("notification-trigger"));
    });

    // Default 'All' shows both
    expect(screen.getByText("Team Invite")).toBeTruthy();
    expect(screen.getByText("Website Published")).toBeTruthy();

    // Click 'Unread' tab
    act(() => {
      fireEvent.click(screen.getByTestId("filter-unread-tab"));
    });
    expect(screen.getByText("Team Invite")).toBeTruthy();
    expect(screen.queryByText("Website Published")).toBeNull();

    // Click back to 'All'
    act(() => {
      fireEvent.click(screen.getByTestId("filter-all-tab"));
    });
    expect(screen.getByText("Website Published")).toBeTruthy();
  });

  it("displays empty state when there are no notifications", () => {
    render(<NotificationCenter initialNotifications={[]} initialUnreadCount={0} />);

    act(() => {
      fireEvent.click(screen.getByTestId("notification-trigger"));
    });
    expect(screen.getByTestId("notification-empty")).toBeTruthy();
    expect(screen.getByText("All caught up!")).toBeTruthy();
  });

  it("marks notification as read on click and triggers onNotificationClick", async () => {
    const onNotificationClick = vi.fn();
    mockMarkReadAction.mockResolvedValueOnce({ success: true });

    render(
      <NotificationCenter
        initialNotifications={sampleNotifications}
        initialUnreadCount={1}
        onNotificationClick={onNotificationClick}
      />,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("notification-trigger"));
    });

    const item = screen.getByTestId("notification-item-n-1");
    await act(async () => {
      fireEvent.click(item);
    });

    expect(onNotificationClick).toHaveBeenCalledWith(expect.objectContaining({ id: "n-1" }));
    expect(mockMarkReadAction).toHaveBeenCalledWith({ notificationId: "n-1" });
  });

  it("marks all notifications as read when clicking Mark all as read", async () => {
    mockMarkAllReadAction.mockResolvedValueOnce({ success: true, data: { updatedCount: 1 } });

    render(
      <NotificationCenter initialNotifications={sampleNotifications} initialUnreadCount={1} />,
    );

    act(() => {
      fireEvent.click(screen.getByTestId("notification-trigger"));
    });

    const markAllBtn = screen.getByTestId("mark-all-read-btn");
    await act(async () => {
      fireEvent.click(markAllBtn);
    });

    expect(mockMarkAllReadAction).toHaveBeenCalled();
  });
});
