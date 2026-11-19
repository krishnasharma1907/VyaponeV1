import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSiteByBusinessId,
  getSiteById,
  getSiteConfiguration,
  getSiteVersions,
  saveSiteDraftConfiguration,
} from "@/lib/websites/service";
import { assertBusinessAccess } from "@/lib/auth/tenant-access";
import { recordAuditEvent } from "@/lib/audit/service";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BusinessMemberRow, BusinessRow } from "@/lib/businesses/types";
import type { SiteRow, SiteVersionRow } from "@/lib/websites/types";

vi.mock("@/lib/auth/tenant-access", () => ({
  assertBusinessAccess: vi.fn(),
}));

vi.mock("@/lib/audit/service", () => ({
  recordAuditEvent: vi.fn(),
}));

describe("VO-040 Website Service Layer", () => {
  const mockUserId = "00000000-0000-4000-8000-000000000001";
  const mockBusinessId = "00000000-0000-4000-8000-000000000002";
  const mockWorkspaceId = "00000000-0000-4000-8000-000000000003";
  const mockSiteId = "00000000-0000-4000-8000-000000000004";
  const mockVersionId = "00000000-0000-4000-8000-000000000005";

  const sampleSite = {
    id: mockSiteId,
    business_id: mockBusinessId,
    subdomain: "sharma-sweets",
    custom_domain: null,
    theme_id: "emerald-marigold",
    status: "draft" as const,
    published_version_id: null,
    current_draft_version_id: mockVersionId,
    published_at: null,
    created_at: "2026-11-19T10:00:00Z",
    updated_at: "2026-11-19T10:00:00Z",
  };

  const sampleConfig = buildInitialWebsiteConfiguration({
    siteId: mockSiteId,
    businessId: mockBusinessId,
    tradeName: "Sharma Sweets & Snacks",
    subdomain: "sharma-sweets",
  });

  const sampleVersion = {
    id: mockVersionId,
    site_id: mockSiteId,
    business_id: mockBusinessId,
    version_number: 1,
    schema_version: "v1",
    configuration: sampleConfig,
    change_summary: "Initial website setup",
    created_by: mockUserId,
    created_at: "2026-11-19T10:00:00Z",
    published_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertBusinessAccess).mockResolvedValue({
      business: { id: mockBusinessId, workspace_id: mockWorkspaceId } as unknown as BusinessRow,
      member: { id: "mem-1", role: "owner" } as unknown as BusinessMemberRow,
      callerUserId: mockUserId,
      isSovereignOwner: true,
      effectiveRole: "owner",
      locationId: null,
    });
  });

  describe("getSiteByBusinessId", () => {
    it("enforces tenant access and returns the site record", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const site = await getSiteByBusinessId(mockSupabase, mockBusinessId);
      expect(assertBusinessAccess).toHaveBeenCalledWith(mockSupabase, mockBusinessId);
      expect(site).toEqual(sampleSite);
    });

    it("throws WebsiteError when database query errors", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: { message: "DB Error" } })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(getSiteByBusinessId(mockSupabase, mockBusinessId)).rejects.toMatchObject({
        code: "SITE_FETCH_FAILED",
        statusCode: 500,
      });
    });
  });

  describe("getSiteById", () => {
    it("retrieves site by primary ID and verifies business access", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const site = await getSiteById(mockSupabase, mockSiteId);
      expect(site).toEqual(sampleSite);
      expect(assertBusinessAccess).toHaveBeenCalledWith(mockSupabase, mockBusinessId);
    });

    it("throws 404 WebsiteError when site is not found", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        getSiteById(mockSupabase, "00000000-0000-4000-8000-000000000099"),
      ).rejects.toMatchObject({
        code: "SITE_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("getSiteVersions", () => {
    it("retrieves versions ordered descending by version_number", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
                })),
              })),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(async () => ({ data: [sampleVersion], error: null })),
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
      } as unknown as SupabaseClient<Database>;

      const versions = await getSiteVersions(mockSupabase, mockSiteId);
      expect(versions).toHaveLength(1);
      expect(versions[0].version_number).toBe(1);
    });
  });

  describe("getSiteConfiguration", () => {
    it("retrieves current draft configuration when versionNumber is omitted", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
                })),
              })),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((col: string, _val: string) => {
                  if (col === "site_id") {
                    return {
                      eq: vi.fn((col2: string, val2: string) => {
                        expect(col2).toBe("id");
                        expect(val2).toBe(mockVersionId);
                        return {
                          maybeSingle: vi.fn(async () => ({ data: sampleVersion, error: null })),
                        };
                      }),
                    };
                  }
                  return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
                }),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await getSiteConfiguration(mockSupabase, mockSiteId);
      expect(result.version.id).toBe(mockVersionId);
      expect(result.configuration.schemaVersion).toBe("v1");
      expect(result.configuration.siteId).toBe(mockSiteId);
    });

    it("throws 404 when requested version is not found", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
                })),
              })),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(getSiteConfiguration(mockSupabase, mockSiteId, 99)).rejects.toMatchObject({
        code: "VERSION_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("saveSiteDraftConfiguration", () => {
    it("creates a new sequential version, verifies media ownership, updates site pointer, and logs audit event", async () => {
      const validMediaId = "00000000-0000-4000-8000-000000000099";
      const configWithMedia = {
        ...sampleConfig,
        header: {
          ...sampleConfig.header,
          logoMediaId: validMediaId,
        },
      };

      const newVersionId = "00000000-0000-4000-8000-000000000006";
      let insertedVersion: SiteVersionRow | null = null;
      let updatedSiteData: Partial<SiteRow> | null = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
                })),
              })),
              update: vi.fn((payload: unknown) => {
                updatedSiteData = payload as Partial<SiteRow>;
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({
                        data: { ...sampleSite, ...(payload as object) },
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "media_items") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(async () => ({
                  data: [
                    {
                      id: validMediaId,
                      business_id: mockBusinessId,
                      workspace_id: mockWorkspaceId,
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(async () => ({
                      data: [{ version_number: 2 }],
                    })),
                  })),
                })),
              })),
              insert: vi.fn((payload: unknown) => {
                insertedVersion = {
                  id: newVersionId,
                  ...(payload as object),
                } as unknown as SiteVersionRow;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: insertedVersion,
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await saveSiteDraftConfiguration(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        configuration: configWithMedia,
        changeSummary: "Updated header with official logo",
      });

      expect(insertedVersion!.version_number).toBe(3); // 2 + 1
      expect(insertedVersion!.site_id).toBe(mockSiteId);
      expect(insertedVersion!.business_id).toBe(mockBusinessId);
      expect(updatedSiteData!.current_draft_version_id).toBe(newVersionId);

      expect(recordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          businessId: mockBusinessId,
          actorUserId: mockUserId,
          action: "site.version_created",
          resource: "site",
          metadata: expect.objectContaining({
            site_id: mockSiteId,
            version_id: newVersionId,
            version_number: 3,
            change_summary: "Updated header with official logo",
          }),
        }),
      );

      expect(result.version.id).toBe(newVersionId);
      expect(result.site.current_draft_version_id).toBe(newVersionId);
    });

    it("rejects saving if siteId does not match configuration siteId", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const mismatchedConfig = {
        ...sampleConfig,
        siteId: "00000000-0000-4000-8000-999999999999",
      };

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: mismatchedConfig,
        }),
      ).rejects.toMatchObject({
        code: "SITE_ID_MISMATCH",
        statusCode: 400,
      });
    });

    it("rejects saving if referenced media item belongs to another tenant (media isolation)", async () => {
      const foreignMediaId = "00000000-0000-4000-8000-888888888888";
      const configWithForeignMedia = {
        ...sampleConfig,
        header: {
          ...sampleConfig.header,
          logoMediaId: foreignMediaId,
        },
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
                })),
              })),
            };
          }
          if (table === "media_items") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(async () => ({
                  data: [
                    {
                      id: foreignMediaId,
                      business_id: "other-foreign-business-id",
                      workspace_id: "other-foreign-workspace-id",
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: configWithForeignMedia,
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_ISOLATION_VIOLATION",
        statusCode: 403,
      });
    });
  });
});
