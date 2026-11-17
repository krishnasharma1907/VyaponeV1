import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Mock server-only for tests running in Node/Vitest
vi.mock("server-only", () => ({}));

import { updateBusinessProfile, confirmBusinessFact } from "@/lib/businesses/service";
import { updateBusinessProfileAction, confirmBusinessFactAction } from "@/lib/businesses/actions";
import {
  updateBusinessProfileSchema,
  confirmBusinessFactSchema,
  addressConfigurationSchema,
  timingsConfigurationSchema,
} from "@/lib/businesses/schemas";
import type { BusinessRow } from "@/lib/businesses/types";

// Mock createServerSupabaseClient for Server Action tests
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe("VO-025 Business Profile Settings & Provenance", () => {
  const mockOwnerId = "usr-owner-001";
  const mockStaffId = "usr-staff-003";
  const mockBusinessId = "biz-001";
  const mockWorkspaceId = "ws-001";

  const sampleBusiness: BusinessRow = {
    id: mockBusinessId,
    workspace_id: mockWorkspaceId,
    legal_name: "Sharma Enterprises Pvt Ltd",
    trade_name: "Sharma Kirana",
    slug: "sharma-kirana",
    category: "grocery",
    niche_id: null,
    description: "Daily essentials and kirana store.",
    gst_number: "29AAAAA0000A1Z5",
    pan_number: "AAAAA0000A",
    tax_scheme: "registered",
    status: "active",
    currency_code: "INR",
    preferred_language: "en",
    timezone: "Asia/Kolkata",
    contact_configuration: {
      primary_phone: "+919876543210",
      whatsapp_number: "+919876543210",
      email: "owner@sharmastore.in",
    },
    address_configuration: {
      address_line1: "100 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560001",
      country: "India",
    },
    timings_configuration: {
      monday: { open: "08:00", close: "21:00", closed: false },
      sunday: { open: "09:00", close: "18:00", closed: false },
    },
    facts_provenance: {
      gst_number: {
        confirmed: true,
        source: "gst_portal",
        confirmed_at: "2026-11-13T00:00:00.000Z",
      },
      trade_name: {
        confirmed: true,
        source: "user_confirmed",
        confirmed_at: "2026-11-13T00:00:00.000Z",
      },
    },
    sovereign_owner_id: mockOwnerId,
    created_at: "2026-11-13T00:00:00.000Z",
    updated_at: "2026-11-13T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------------------
  // 1. Validation Schemas & Sensitive Facts
  // ----------------------------------------------------------------------------
  describe("1. Validation & Schema Enforcement", () => {
    it("validates valid business profile update payload", () => {
      const validPayload = {
        trade_name: "Sharma Mega Store",
        legal_name: "Sharma Retail Pvt Ltd",
        category: "retail",
        description: "Department store",
        gst_number: "29BBBBB1111B1Z2",
        pan_number: "BBBBB1111B",
        tax_scheme: "registered" as const,
        currency_code: "INR",
        preferred_language: "hi",
        timezone: "Asia/Kolkata",
        contact_configuration: {
          primary_phone: "+919876543210",
          whatsapp_number: "+919876543210",
          email: "support@sharma.in",
        },
        address_configuration: {
          address_line1: "42 Residency Road",
          city: "Bengaluru",
          state: "Karnataka",
          postal_code: "560025",
        },
        timings_configuration: {
          monday: { open: "09:00", close: "22:00", closed: false },
        },
      };

      const result = updateBusinessProfileSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("rejects invalid GSTIN statutory tax format", () => {
      const invalidGstin = {
        gst_number: "INVALID_GST_123",
      };
      const result = updateBusinessProfileSchema.safeParse(invalidGstin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.gst_number).toBeDefined();
      }
    });

    it("rejects invalid PAN format", () => {
      const invalidPan = {
        pan_number: "12345ABCDE", // Numbers first is invalid
      };
      const result = updateBusinessProfileSchema.safeParse(invalidPan);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.pan_number).toBeDefined();
      }
    });

    it("rejects invalid Indian PIN postal code in address", () => {
      const invalidAddress = {
        postal_code: "56000", // 5 digits instead of 6
      };
      const result = addressConfigurationSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it("rejects invalid timing hour format in timings configuration", () => {
      const invalidTimings = {
        monday: { open: "25:00", close: "21:00" }, // 25:00 is invalid
      };
      const result = timingsConfigurationSchema.safeParse(invalidTimings);
      expect(result.success).toBe(false);
    });

    it("validates fact confirmation schema", () => {
      const valid = confirmBusinessFactSchema.safeParse({
        field: "gst_number",
        confirmed: true,
      });
      expect(valid.success).toBe(true);

      const invalid = confirmBusinessFactSchema.safeParse({
        field: "",
        confirmed: true,
      });
      expect(invalid.success).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Service Layer: Permitted Updates & Role Authorization
  // ----------------------------------------------------------------------------
  describe("2. Service Layer Profile Updates & Audit Logging", () => {
    it("allows sovereign owner to update all business profile fields", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: mockWorkspaceId,
                    },
                    error: null,
                  })),
                  single: vi.fn(async () => ({ data: sampleBusiness, error: null })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        ...sampleBusiness,
                        trade_name: "Sharma Mega Mart",
                        category: "retail",
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const updated = await updateBusinessProfile(mockSupabase, mockBusinessId, mockOwnerId, {
        trade_name: "Sharma Mega Mart",
        category: "retail",
      });

      expect(updated.trade_name).toBe("Sharma Mega Mart");
      expect(updated.category).toBe("retail");

      // Verify audit log write
      expect(mockSupabase.from).toHaveBeenCalledWith("audit_logs");
    });

    it("rejects profile updates from operational staff without permission", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: null,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { role: "staff", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateBusinessProfile(mockSupabase, mockBusinessId, mockStaffId, {
          trade_name: "Hacked Store",
        }),
      ).rejects.toThrow("You do not have permission to update this business profile");
    });

    it("rejects updates targeting a non-existent business", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateBusinessProfile(mockSupabase, "non-existent-biz", mockOwnerId, {
          trade_name: "Some Name",
        }),
      ).rejects.toThrow("You do not have permission to update this business profile");
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Sensitive Fact Provenance & Confirmation
  // ----------------------------------------------------------------------------
  describe("3. Fact Provenance Tracking", () => {
    it("toggles and records fact confirmation with audit trail", async () => {
      type FactRecord = { confirmed: boolean; source: string; confirmed_by: string | null };
      let savedProvenance: Record<string, FactRecord> | null = null;
      let auditLogRecord: {
        action: string;
        metadata_json: Record<string, unknown>;
      } | null = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: mockWorkspaceId,
                    },
                    error: null,
                  })),
                  single: vi.fn(async () => ({ data: sampleBusiness, error: null })),
                })),
              })),
              update: vi.fn((updates: { facts_provenance: Record<string, FactRecord> }) => {
                savedProvenance = updates.facts_provenance;
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({
                        data: { ...sampleBusiness, facts_provenance: savedProvenance },
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "business_members" || table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(
                async (log: { action: string; metadata_json: Record<string, unknown> }) => {
                  auditLogRecord = log;
                  return { error: null };
                },
              ),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const confirmedResult = await confirmBusinessFact(
        mockSupabase,
        mockBusinessId,
        mockOwnerId,
        "operating_timings",
        true,
      );

      expect(confirmedResult.id).toBe(mockBusinessId);
      const prov = savedProvenance as unknown as Record<string, FactRecord>;
      const audit = auditLogRecord as unknown as {
        action: string;
        metadata_json: Record<string, unknown>;
      };
      expect(prov.operating_timings.confirmed).toBe(true);
      expect(prov.operating_timings.source).toBe("user_confirmed");
      expect(prov.operating_timings.confirmed_by).toBe(mockOwnerId);

      // Verify audit log event
      expect(audit.action).toBe("business.fact_confirmed");
      expect(audit.metadata_json.field).toBe("operating_timings");
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Server Actions: Authentication & Authorization Boundaries
  // ----------------------------------------------------------------------------
  describe("4. Server Actions Boundary & Error Sanitization", () => {
    it("rejects unauthenticated profile update attempts", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

      const result = await updateBusinessProfileAction(mockBusinessId, {
        trade_name: "Unauthenticated Edit",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("UNAUTHENTICATED");
      }
    });

    it("rejects unauthenticated fact confirmation attempts", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No session") });

      const result = await confirmBusinessFactAction(mockBusinessId, {
        field: "gst_number",
        confirmed: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("UNAUTHENTICATED");
      }
    });

    it("sanitizes unexpected database errors without leaking internal details", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: mockOwnerId } },
        error: null,
      });

      // Simulate database connection failure
      mockFrom.mockImplementationOnce(() => {
        throw new Error("FATAL: connection limit exceeded for database postgres");
      });

      const result = await updateBusinessProfileAction(mockBusinessId, {
        trade_name: "Valid Name",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).not.toContain("FATAL:");
        expect(result.error).not.toContain("postgres");
      }
    });
  });
});
