import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSiteByBusinessId,
  getSiteById,
  getSiteConfiguration,
  getSiteVersions,
  loadOwnerWebsiteWorkspace,
  saveSiteDraftConfiguration,
} from "@/lib/websites/service";
import { assertAuthenticatedUser, assertBusinessAccess } from "@/lib/auth/tenant-access";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import type { SaveSiteDraftInput } from "@/lib/websites/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BusinessMemberRow, BusinessRow } from "@/lib/businesses/types";

vi.mock("@/lib/auth/tenant-access", () => ({
  assertBusinessAccess: vi.fn(),
  assertAuthenticatedUser: vi.fn(),
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
    it("creates a new sequential version atomically via RPC, verifying media and updating site pointer", async () => {
      const validMediaId = "00000000-0000-4000-8000-000000000099";
      const configWithMedia = {
        ...sampleConfig,
        header: {
          ...sampleConfig.header,
          logoMediaId: validMediaId,
        },
      };

      const newVersionId = "00000000-0000-4000-8000-000000000006";
      const mockRpcResponse = {
        version: {
          id: newVersionId,
          site_id: mockSiteId,
          business_id: mockBusinessId,
          version_number: 3,
          schema_version: "v1",
          configuration: configWithMedia,
          change_summary: "Updated header with official logo",
          created_by: mockUserId,
          created_at: "2026-11-19T10:05:00Z",
          published_at: null,
        },
        site: {
          ...sampleSite,
          current_draft_version_id: newVersionId,
          updated_at: "2026-11-19T10:05:00Z",
        },
      };

      const mockRpc = vi.fn(async (funcName: string, args: Record<string, unknown>) => {
        expect(funcName).toBe("save_site_draft_configuration_atomic");
        expect(args.p_site_id).toBe(mockSiteId);
        expect(args.p_business_id).toBe(mockBusinessId);
        expect(args.p_caller_user_id).toBe(mockUserId);
        expect(args.p_schema_version).toBe("v1");
        expect(args.p_change_summary).toBe("Updated header with official logo");
        expect(args.p_referenced_media_ids).toEqual([validMediaId]);
        expect(args.p_expected_base_version_number).toBe(2);
        return { data: mockRpcResponse, error: null };
      });

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
                      id: validMediaId,
                      business_id: mockBusinessId,
                      workspace_id: mockWorkspaceId,
                      status: "ready",
                      verified_at: "2026-11-19T10:00:00Z",
                      category: "business_logo",
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
        rpc: mockRpc,
      } as unknown as SupabaseClient<Database>;

      const result = await saveSiteDraftConfiguration(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        configuration: configWithMedia,
        changeSummary: "Updated header with official logo",
        expectedBaseVersionNumber: 2,
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(result.version.id).toBe(newVersionId);
      expect(result.version.version_number).toBe(3);
      expect(result.site.current_draft_version_id).toBe(newVersionId);
      expect(result.configuration.siteId).toBe(mockSiteId);
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
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      const mismatchedConfig = {
        ...sampleConfig,
        siteId: "00000000-0000-4000-8000-999999999999",
      };

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: mismatchedConfig,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "SITE_ID_MISMATCH",
        statusCode: 400,
      });
    });

    it("rejects saving if businessId does not match site business owner", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      const mismatchedConfig = {
        ...sampleConfig,
        businessId: "00000000-0000-4000-8000-999999999999",
      };

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: mismatchedConfig,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "BUSINESS_ID_MISMATCH",
        statusCode: 400,
      });
    });

    it("rejects saving if referenced media item does not exist", async () => {
      const nonExistentMediaId = "00000000-0000-4000-8000-777777777777";
      const configWithMissingMedia = {
        ...sampleConfig,
        header: {
          ...sampleConfig.header,
          logoMediaId: nonExistentMediaId,
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
                  data: [],
                  error: null,
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: configWithMissingMedia,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_NOT_FOUND",
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
                      status: "ready",
                      verified_at: "2026-11-19T10:00:00Z",
                      category: "business_logo",
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: configWithForeignMedia,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_ISOLATION_VIOLATION",
        statusCode: 403,
      });
    });

    it("rejects saving if referenced media item is unverified or not ready (Audit E)", async () => {
      const unverifiedMediaId = "00000000-0000-4000-8000-666666666666";
      const configWithUnverifiedMedia = {
        ...sampleConfig,
        header: {
          ...sampleConfig.header,
          logoMediaId: unverifiedMediaId,
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
                      id: unverifiedMediaId,
                      business_id: mockBusinessId,
                      workspace_id: mockWorkspaceId,
                      status: "pending_upload",
                      verified_at: null,
                      category: "business_logo",
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: configWithUnverifiedMedia,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_NOT_READY",
        statusCode: 400,
      });
    });

    it("rejects saving if referenced media has an unapproved category (Audit E)", async () => {
      const docMediaId = "00000000-0000-4000-8000-555555555555";
      const configWithDocMedia = {
        ...sampleConfig,
        header: {
          ...sampleConfig.header,
          logoMediaId: docMediaId,
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
                      id: docMediaId,
                      business_id: mockBusinessId,
                      workspace_id: mockWorkspaceId,
                      status: "ready",
                      verified_at: "2026-11-19T10:00:00Z",
                      category: "document_attachment",
                    },
                  ],
                  error: null,
                })),
              })),
            };
          }
          return {} as unknown as ReturnType<SupabaseClient<Database>["from"]>;
        }),
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: configWithDocMedia,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_CATEGORY_NOT_ALLOWED",
        statusCode: 400,
      });
    });

    it("handles atomic RPC authorization and permission failures properly", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
        rpc: vi.fn(async () => ({
          data: null,
          error: {
            message: "You do not have permission to modify websites for this business",
            code: "VY021",
          },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: sampleConfig,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });
    });

    it("handles atomic RPC media validation failures properly", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
        rpc: vi.fn(async () => ({
          data: null,
          error: {
            message: "Referenced media item is not verified and ready for use",
            code: "VY032",
          },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: sampleConfig,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "MEDIA_VALIDATION_FAILED",
        statusCode: 400,
      });
    });

    it("handles concurrency conflict error (VY049) and returns CONFLICT code (VO-044 Audit C)", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
        rpc: vi.fn(async () => ({
          data: null,
          error: {
            message:
              "Concurrency conflict: current draft version is 3, but save was based on version 1",
            code: "VY049",
          },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        saveSiteDraftConfiguration(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          configuration: sampleConfig,
          expectedBaseVersionNumber: 1,
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        statusCode: 409,
      });
    });

    it("rejects saving if expectedBaseVersionNumber is omitted (prevent bypass)", async () => {
      const mockSupabase = {
        from: vi.fn(),
        rpc: vi.fn(),
      } as unknown as SupabaseClient<Database>;

      const inputMissingExpectedVersion = {
        siteId: mockSiteId,
        configuration: sampleConfig,
      };

      await expect(
        saveSiteDraftConfiguration(
          mockSupabase,
          mockUserId,
          inputMissingExpectedVersion as unknown as SaveSiteDraftInput,
        ),
      ).rejects.toThrow();
    });

    it("passes expectedBaseVersionNumber as null when initializing initial draft", async () => {
      const mockRpc = vi.fn(async (funcName: string, args: Record<string, unknown>) => {
        expect(funcName).toBe("save_site_draft_configuration_atomic");
        expect(args.p_expected_base_version_number).toBeNull();
        return {
          data: {
            site: { ...sampleSite, current_draft_version_id: "ver-1" },
            version: { id: "ver-1", version_number: 1 },
          },
          error: null,
        };
      });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
        rpc: mockRpc,
      } as unknown as SupabaseClient<Database>;

      const result = await saveSiteDraftConfiguration(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        configuration: sampleConfig,
        expectedBaseVersionNumber: null,
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(result.version.version_number).toBe(1);
    });

    it("passes explicit integer expectedBaseVersionNumber when updating existing draft", async () => {
      const mockRpc = vi.fn(async (funcName: string, args: Record<string, unknown>) => {
        expect(funcName).toBe("save_site_draft_configuration_atomic");
        expect(args.p_expected_base_version_number).toBe(4);
        return {
          data: {
            site: { ...sampleSite, current_draft_version_id: "ver-5" },
            version: { id: "ver-5", version_number: 5 },
          },
          error: null,
        };
      });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: sampleSite, error: null })),
            })),
          })),
        })),
        rpc: mockRpc,
      } as unknown as SupabaseClient<Database>;

      const result = await saveSiteDraftConfiguration(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        configuration: sampleConfig,
        expectedBaseVersionNumber: 4,
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(result.version.version_number).toBe(5);
    });
  });

  describe("VO-044 Owner Website Workspace Loader", () => {
    it("loads tenant-scoped business, locations, catalogue items, site, and configuration for authorized owner", async () => {
      const sampleBusiness = {
        id: mockBusinessId,
        trade_name: "Sharma Sweets",
        legal_name: "Sharma Sweets Private Limited",
        category: "sweets",
        description: "Fresh sweets daily",
        workspace_id: mockWorkspaceId,
        contact_configuration: {
          primary_phone: "+919876543210",
          whatsapp_number: "+919876543210",
        },
      } as unknown as BusinessRow;

      vi.mocked(assertAuthenticatedUser).mockResolvedValueOnce({ id: mockUserId });
      vi.mocked(assertBusinessAccess).mockResolvedValueOnce({
        business: sampleBusiness,
        callerUserId: mockUserId,
        isSovereignOwner: true,
        effectiveRole: "owner",
        member: null,
        locationId: null,
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "locations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        address_line1: "100 MG Road",
                        city: "Bengaluru",
                        state: "Karnataka",
                        postal_code: "560001",
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "catalogue_items") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    limit: vi.fn(async () => ({
                      data: [
                        {
                          id: "cat-1",
                          title: "Kaju Katli",
                          name: "Kaju Katli",
                          price_minor: 25000n,
                          currency_code: "INR",
                          is_available: true,
                        },
                      ],
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
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
                    maybeSingle: vi.fn(async () => ({ data: sampleVersion, error: null })),
                  })),
                })),
              })),
            };
          }
          const chainable: Record<string, unknown> = {
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
          };
          chainable.eq = vi.fn(() => chainable);
          chainable.in = vi.fn(() => chainable);
          chainable.order = vi.fn(() => chainable);
          chainable.limit = vi.fn(() => chainable);

          return {
            select: vi.fn(() => chainable),
          };
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await loadOwnerWebsiteWorkspace(mockSupabase, mockBusinessId);

      expect(result.business.id).toBe(mockBusinessId);
      expect(result.business.tradeName).toBe("Sharma Sweets");
      expect(result.site.id).toBe(mockSiteId);
      expect(result.version.id).toBe(mockVersionId);
      expect(result.catalogueItems).toHaveLength(1);
      expect(result.catalogueItems[0].name).toBe("Kaju Katli");
      expect(result.business.primaryLocation?.city).toBe("Bengaluru");
    });

    it("rejects unauthorized cross-tenant workspace access attempts", async () => {
      vi.mocked(assertAuthenticatedUser).mockResolvedValueOnce({ id: mockUserId });
      vi.mocked(assertBusinessAccess).mockRejectedValueOnce(
        new Error("Business not found or access denied"),
      );

      const mockSupabase = {} as unknown as SupabaseClient<Database>;

      await expect(
        loadOwnerWebsiteWorkspace(mockSupabase, "99999999-9999-4999-8999-999999999999"),
      ).rejects.toThrow("Business not found or access denied");
    });
  });
});
