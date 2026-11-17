import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import { isSensitiveKey, redactSensitiveData } from "@/lib/audit/redaction";
import {
  listBusinessAuditLogs,
  listWorkspaceAuditLogs,
  recordAuditEvent,
} from "@/lib/audit/service";
import { listBusinessAuditLogsAction, listWorkspaceAuditLogsAction } from "@/lib/audit/actions";
import { TenantAccessError } from "@/lib/auth/tenant-access";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock tenant-access helpers
const mockAssertWorkspaceAccess = vi.fn();
const mockAssertBusinessAccess = vi.fn();
const mockAssertAuthenticatedUser = vi.fn();

vi.mock("@/lib/auth/tenant-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/tenant-access")>();
  return {
    ...actual,
    assertWorkspaceAccess: (...args: unknown[]) => mockAssertWorkspaceAccess(...args),
    assertBusinessAccess: (...args: unknown[]) => mockAssertBusinessAccess(...args),
    assertAuthenticatedUser: (...args: unknown[]) => mockAssertAuthenticatedUser(...args),
  };
});

// Mock Supabase server client for Server Actions
const mockServerSupabase: {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
} = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => mockServerSupabase),
}));

describe("VO-028 Audit Service & Redaction Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Sensitive Credential Redaction", () => {
    it("identifies sensitive credential keys accurately", () => {
      expect(isSensitiveKey("password")).toBe(true);
      expect(isSensitiveKey("current_password")).toBe(true);
      expect(isSensitiveKey("newPassword")).toBe(true);
      expect(isSensitiveKey("token")).toBe(true);
      expect(isSensitiveKey("access_token")).toBe(true);
      expect(isSensitiveKey("refresh_token")).toBe(true);
      expect(isSensitiveKey("secret")).toBe(true);
      expect(isSensitiveKey("client_secret")).toBe(true);
      expect(isSensitiveKey("api_key")).toBe(true);
      expect(isSensitiveKey("apiKey")).toBe(true);
      expect(isSensitiveKey("otp")).toBe(true);
      expect(isSensitiveKey("auth_code")).toBe(true);
      expect(isSensitiveKey("private_key")).toBe(true);
      expect(isSensitiveKey("cvv")).toBe(true);
      expect(isSensitiveKey("CVV")).toBe(true);
      expect(isSensitiveKey("credit_card")).toBe(true);
      expect(isSensitiveKey("cardNumber")).toBe(true);
      expect(isSensitiveKey("debitCard")).toBe(true);
      expect(isSensitiveKey("pAsSwOrD")).toBe(true);
      expect(isSensitiveKey("CLIENT_SECRET")).toBe(true);
      expect(isSensitiveKey("cUrReNt_PaSsWoRd")).toBe(true);
      expect(isSensitiveKey("pin")).toBe(true);
      expect(isSensitiveKey("ATM_PIN")).toBe(true);

      // Non-sensitive keys and statutory Indian fields
      expect(isSensitiveKey("display_name")).toBe(false);
      expect(isSensitiveKey("workspace_id")).toBe(false);
      expect(isSensitiveKey("action")).toBe(false);
      expect(isSensitiveKey("slug")).toBe(false);
      expect(isSensitiveKey("pincode")).toBe(false);
      expect(isSensitiveKey("pin_code")).toBe(false);
      expect(isSensitiveKey("postal_pin")).toBe(false);
      expect(isSensitiveKey("postalpin")).toBe(false);
      expect(isSensitiveKey("pan_number")).toBe(false);
      expect(isSensitiveKey("pannumber")).toBe(false);
      expect(isSensitiveKey("tax_pan")).toBe(false);
      expect(isSensitiveKey("gstin")).toBe(false);
      expect(isSensitiveKey("gst_number")).toBe(false);
    });

    it("redacts sensitive fields in nested objects and arrays", () => {
      const input = {
        userId: "usr-123",
        role: "admin",
        securityDetails: {
          password: "SuperSecretPassword123!",
          api_key: "vyap_live_987654321",
        },
        tokens: ["token-abc", "normal-string"],
        nested: {
          deep: {
            auth_token: "jwt-token-xyz",
            public_name: "VyapOne Store",
          },
        },
      };

      const redacted = redactSensitiveData(input) as Record<string, unknown>;

      expect(redacted.userId).toBe("usr-123");
      expect(redacted.role).toBe("admin");
      expect((redacted.securityDetails as Record<string, unknown>).password).toBe("[REDACTED]");
      expect((redacted.securityDetails as Record<string, unknown>).api_key).toBe("[REDACTED]");
      expect(redacted.tokens).toBe("[REDACTED]");
      expect((redacted.nested as Record<string, unknown>).deep).toEqual({
        auth_token: "[REDACTED]",
        public_name: "VyapOne Store",
      });
    });

    it("preserves statutory Indian address and tax identifiers while redacting payment credentials", () => {
      const input = {
        businessId: "biz-456",
        statutoryDetails: {
          gstin: "27AAAAA0000A1Z5",
          pan_number: "AAAAA0000A",
          tax_pan: "AAAAA0000A",
          gst_number: "27AAAAA0000A1Z5",
          address: {
            city: "Mumbai",
            pincode: "400001",
            postal_pin: "400001",
          },
        },
        paymentDetails: {
          cardNumber: "4111111111111111",
          cvv: "123",
          atm_pin: "9999",
          client_secret: "sk_live_secret",
        },
      };

      const redacted = redactSensitiveData(input) as typeof input;

      // Preserved statutory details
      expect(redacted.businessId).toBe("biz-456");
      expect(redacted.statutoryDetails.gstin).toBe("27AAAAA0000A1Z5");
      expect(redacted.statutoryDetails.pan_number).toBe("AAAAA0000A");
      expect(redacted.statutoryDetails.tax_pan).toBe("AAAAA0000A");
      expect(redacted.statutoryDetails.gst_number).toBe("27AAAAA0000A1Z5");
      expect(redacted.statutoryDetails.address.city).toBe("Mumbai");
      expect(redacted.statutoryDetails.address.pincode).toBe("400001");
      expect(redacted.statutoryDetails.address.postal_pin).toBe("400001");

      // Redacted sensitive payment credentials
      expect((redacted.paymentDetails as Record<string, unknown>).cardNumber).toBe("[REDACTED]");
      expect((redacted.paymentDetails as Record<string, unknown>).cvv).toBe("[REDACTED]");
      expect((redacted.paymentDetails as Record<string, unknown>).atm_pin).toBe("[REDACTED]");
      expect((redacted.paymentDetails as Record<string, unknown>).client_secret).toBe("[REDACTED]");
    });

    it("redacts raw Bearer token headers in strings", () => {
      const input = {
        authorizationHeader: "Bearer secret-token-12345",
      };
      const redacted = redactSensitiveData(input);
      expect(redacted.authorizationHeader).toBe("[REDACTED]");
    });

    it("handles circular references gracefully without crashing", () => {
      interface CircularObj {
        name: string;
        self?: CircularObj;
      }
      const circular: CircularObj = { name: "test" };
      circular.self = circular;

      expect(() => redactSensitiveData(circular)).not.toThrow();
      const result = redactSensitiveData(circular);
      expect(result.name).toBe("test");
      expect(result.self).toBe("[CIRCULAR]");
    });

    it("preserves null, undefined, dates and primitives", () => {
      const now = new Date();
      expect(redactSensitiveData(null)).toBeNull();
      expect(redactSensitiveData(undefined)).toBeUndefined();
      expect(redactSensitiveData(42)).toBe(42);
      expect(redactSensitiveData("hello")).toBe("hello");
      expect(redactSensitiveData(now)).toBe(now);
    });
  });

  describe("recordAuditEvent", () => {
    it("inserts audit event and redacts metadata automatically", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "log-1",
          workspace_id: "ws-1",
          business_id: null,
          user_id: "usr-1",
          action: "workspace.member_invited",
          resource: "membership",
          metadata_json: { email: "team@example.com", token: "[REDACTED]" },
          ip_address: "192.168.1.1",
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: "usr-1" } }, error: null }),
        },
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      const result = await recordAuditEvent(mockSupabase, {
        action: "workspace.member_invited",
        resource: "membership",
        workspaceId: "ws-1",
        ipAddress: "192.168.1.1",
        metadata: {
          email: "team@example.com",
          token: "raw-secret-invitation-token",
        },
      });

      expect(mockFrom).toHaveBeenCalledWith("audit_logs");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: "ws-1",
          business_id: null,
          user_id: "usr-1",
          action: "workspace.member_invited",
          resource: "membership",
          metadata_json: {
            email: "team@example.com",
            token: "[REDACTED]",
          },
          ip_address: "192.168.1.1",
        }),
      );
      expect(result.id).toBe("log-1");
      expect(result.metadata.token).toBe("[REDACTED]");
    });

    it("throws error when audit log insert fails", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      await expect(
        recordAuditEvent(mockSupabase, {
          action: "workspace.created",
          resource: "workspace",
        }),
      ).rejects.toThrow("Failed to record audit event: Database connection failed");
    });
  });

  describe("listWorkspaceAuditLogs", () => {
    it("enforces workspace admin permission check before querying logs", async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      mockAssertWorkspaceAccess.mockResolvedValueOnce({
        role: "workspace_admin",
      });

      const result = await listWorkspaceAuditLogs(mockSupabase, "ws-100", {
        limit: 20,
        offset: 0,
      });

      expect(mockAssertWorkspaceAccess).toHaveBeenCalledWith(mockSupabase, "ws-100", {
        requiredRole: "workspace_admin",
      });
      expect(mockFrom).toHaveBeenCalledWith("audit_logs");
      expect(mockEq).toHaveBeenCalledWith("workspace_id", "ws-100");
      expect(result.totalCount).toBe(0);
      expect(result.logs).toEqual([]);
    });

    it("propagates TenantAccessError when caller lacks workspace access", async () => {
      mockAssertWorkspaceAccess.mockRejectedValueOnce(
        new TenantAccessError("Workspace not found", "NOT_FOUND", 404),
      );

      const mockSupabase = {} as unknown as SupabaseClient<Database>;

      await expect(listWorkspaceAuditLogs(mockSupabase, "ws-999")).rejects.toThrow(
        "Workspace not found",
      );
    });
  });

  describe("listBusinessAuditLogs", () => {
    it("enforces business manager permission check before querying logs", async () => {
      const mockRange = vi.fn().mockResolvedValue({
        data: [
          {
            id: "log-biz-1",
            business_id: "biz-1",
            workspace_id: null,
            user_id: "usr-owner",
            action: "business.updated",
            resource: "business",
            metadata_json: { updatedField: "trade_name" },
            ip_address: null,
            created_at: "2026-11-17T12:00:00Z",
          },
        ],
        count: 1,
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      mockAssertBusinessAccess.mockResolvedValueOnce({
        effectiveRole: "owner",
      });

      const result = await listBusinessAuditLogs(mockSupabase, "biz-1");

      expect(mockAssertBusinessAccess).toHaveBeenCalledWith(mockSupabase, "biz-1", {
        requiredRole: "manager",
      });
      expect(mockEq).toHaveBeenCalledWith("business_id", "biz-1");
      expect(result.totalCount).toBe(1);
      expect(result.logs[0].id).toBe("log-biz-1");
      expect(result.logs[0].action).toBe("business.updated");
    });
  });

  describe("Server Actions", () => {
    it("listWorkspaceAuditLogsAction returns success on authorized request", async () => {
      mockAssertWorkspaceAccess.mockResolvedValueOnce({ role: "workspace_admin" });

      const mockRange = vi.fn().mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockServerSupabase.from.mockReturnValue({ select: mockSelect });

      const res = await listWorkspaceAuditLogsAction("11111111-1111-1111-1111-111111111111", {
        limit: 10,
        offset: 0,
      });

      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.totalCount).toBe(0);
      }
    });

    it("listBusinessAuditLogsAction sanitizes TenantAccessError", async () => {
      mockAssertBusinessAccess.mockRejectedValueOnce(
        new TenantAccessError("Business not found", "NOT_FOUND", 404),
      );

      const res = await listBusinessAuditLogsAction("22222222-2222-2222-2222-222222222222");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Business not found");
      expect(res.code).toBe("NOT_FOUND");
      expect(res.statusCode).toBe(404);
    });
  });
});
