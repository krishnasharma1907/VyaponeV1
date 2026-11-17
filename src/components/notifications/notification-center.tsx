"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { NotificationItem, NotificationType } from "@/lib/notifications/types";
import {
  listNotificationsAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/lib/notifications/actions";

export interface NotificationCenterProps {
  initialNotifications?: NotificationItem[];
  initialUnreadCount?: number;
  workspaceId?: string;
  businessId?: string;
  className?: string;
  onNotificationClick?: (notification: NotificationItem) => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getNotificationTypeBadge(type: NotificationType): { label: string; color: string } {
  switch (type) {
    case "workspace_invitation":
    case "business_invitation":
      return { label: "Invitation", color: "var(--color-primary-600, #059669)" };
    case "membership_change":
    case "role_updated":
      return { label: "Team", color: "var(--color-primary-700, #047857)" };
    case "member_removed":
      return { label: "Access", color: "var(--color-neutral-600, #4b5563)" };
    case "capacity_warning":
      return { label: "Capacity", color: "var(--color-accent-600, #d97706)" };
    case "site_status_changed":
      return { label: "Website", color: "var(--color-primary-600, #059669)" };
    case "security_alert":
      return { label: "Security", color: "var(--color-danger-600, #dc2626)" };
    case "system_announcement":
    default:
      return { label: "System", color: "var(--color-neutral-700, #374151)" };
  }
}

export function NotificationCenter({
  initialNotifications,
  initialUnreadCount,
  workspaceId,
  businessId,
  className = "",
  onNotificationClick,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialNotifications ?? [],
  );
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount ?? 0);
  const [isLoading, setIsLoading] = useState(!initialNotifications);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Fetch or refresh notifications
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await listNotificationsAction({
        limit: 50,
        unreadOnly: filter === "unread",
        workspaceId,
        businessId,
      });

      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Fail safely without disrupting the page
    } finally {
      setIsLoading(false);
    }
  }, [filter, workspaceId, businessId]);

  // Initial load if not provided
  useEffect(() => {
    if (initialNotifications === undefined) {
      loadNotifications();
    }
  }, [initialNotifications, loadNotifications]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && initialNotifications === undefined) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = (notification: NotificationItem) => {
    if (notification.read) {
      onNotificationClick?.(notification);
      return;
    }

    startTransition(async () => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationAsReadAction({ notificationId: notification.id });
      } catch {
        // Revert on failure
        loadNotifications();
      }
    });

    onNotificationClick?.(notification);
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;

    startTransition(async () => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);

      try {
        await markAllNotificationsAsReadAction({ workspaceId, businessId });
      } catch {
        loadNotifications();
      }
    });
  };

  const displayedNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      data-testid="notification-center"
    >
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative inline-flex items-center justify-center p-2 rounded-lg text-neutral-700 hover:text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
        data-testid="notification-trigger"
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-emerald-600 rounded-full min-w-[1.125rem] h-[1.125rem]"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="In-App Notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden flex flex-col max-h-[32rem]"
          data-testid="notification-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50/70">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-neutral-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 focus:outline-none focus:underline disabled:opacity-50"
                data-testid="mark-all-read-btn"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-neutral-200 px-4 pt-2 gap-4 bg-white text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`pb-2 font-medium border-b-2 transition-colors ${
                filter === "all"
                  ? "border-emerald-600 text-emerald-700 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
              data-testid="filter-all-tab"
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`pb-2 font-medium border-b-2 transition-colors ${
                filter === "unread"
                  ? "border-emerald-600 text-emerald-700 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
              data-testid="filter-unread-tab"
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto divide-y divide-neutral-100 flex-1">
            {isLoading ? (
              <div
                className="py-8 text-center text-sm text-neutral-500"
                data-testid="notification-loading"
              >
                Loading notifications...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center" data-testid="notification-empty">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-900">All caught up!</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {filter === "unread"
                    ? "No unread notifications right now."
                    : "No notifications have been received yet."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notification) => {
                const badge = getNotificationTypeBadge(notification.type);
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleMarkAsRead(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleMarkAsRead(notification);
                      }
                    }}
                    className={`p-3.5 transition-colors cursor-pointer text-left focus:outline-none focus:bg-emerald-50/50 ${
                      notification.read
                        ? "bg-white hover:bg-neutral-50"
                        : "bg-emerald-50/30 hover:bg-emerald-50/60"
                    }`}
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded"
                            style={{
                              backgroundColor: `${badge.color}15`,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </div>
                        <h3
                          className={`text-xs ${
                            notification.read
                              ? "font-medium text-neutral-800"
                              : "font-semibold text-neutral-950"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>

                      {!notification.read && (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0"
                          aria-label="Unread"
                          data-testid="unread-indicator"
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
