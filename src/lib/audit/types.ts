/**
 * VyapOne — Audit Logging Types [VO-028]
 *
 * Strongly-typed definitions for the centralized audit logging service.
 * Enforces structured event attribution across actors, tenants, and operational actions.
 */

export type WorkspaceAuditAction =
  | "workspace.created"
  | "workspace.updated"
  | "workspace.archived"
  | "workspace.member_invited"
  | "workspace.member_joined"
  | "workspace.member_removed"
  | "workspace.role_updated"
  | "workspace.capacity_override_created"
  | "workspace.plan_changed";

export type BusinessAuditAction =
  | "business.created"
  | "business.updated"
  | "business.archived"
  | "business.member_invited"
  | "business.member_joined"
  | "business.member_removed"
  | "business.role_updated"
  | "business.location_created"
  | "business.location_updated";

export type SiteAuditAction =
  | "site.created"
  | "site.updated"
  | "site.status_transitioned"
  | "site.published"
  | "site.unpublished"
  | "site.archived"
  | "site.deleted";

export type SecurityAuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.session_revoked"
  | "security.alert"
  | "security.permission_denied";

export type AuditAction =
  | WorkspaceAuditAction
  | BusinessAuditAction
  | SiteAuditAction
  | SecurityAuditAction
  | (string & {});

export type AuditResource =
  | "workspace"
  | "business"
  | "location"
  | "membership"
  | "invitation"
  | "site"
  | "domain"
  | "subscription"
  | "user"
  | "system"
  | (string & {});

export interface AuditEventInput {
  action: AuditAction;
  resource: AuditResource;
  actorUserId?: string | null;
  workspaceId?: string | null;
  businessId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogRecord {
  id: string;
  businessId: string | null;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  action?: string;
  resource?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditQueryResult {
  logs: AuditLogRecord[];
  totalCount: number;
}
