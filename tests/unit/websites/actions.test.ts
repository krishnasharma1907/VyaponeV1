import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  getSiteAction,
  getSiteConfigurationAction,
  saveSiteDraftConfigurationAction,
} from "@/lib/websites/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getSiteByBusinessId,
  getSiteConfiguration,
  saveSiteDraftConfiguration,
  WebsiteError,
} from "@/lib/websites/service";
import { revalidatePath } from "next/cache";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import type { SaveSiteDraftInput } from "@/lib/websites/schemas";
import type { SiteRow, SiteVersionRow, WebsiteConfiguration } from "@/lib/websites/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/websites/service", () => ({
  getSiteByBusinessId: vi.fn(),
  getSiteConfiguration: vi.fn(),
  saveSiteDraftConfiguration: vi.fn(),
  WebsiteError: class WebsiteError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number = 400,
    ) {
      super(message);
      this.name = "WebsiteError";
    }
  },
}));

describe("VO-040 Website Server Actions", () => {
  const mockUserId = "00000000-0000-4000-8000-000000000001";
  const mockBusinessId = "00000000-0000-4000-8000-000000000002";
  const mockSiteId = "00000000-0000-4000-8000-000000000003";

  const sampleConfig = buildInitialWebsiteConfiguration({
    siteId: mockSiteId,
    businessId: mockBusinessId,
    tradeName: "Delhi Spice Corner",
    subdomain: "delhispice",
  });

  const mockSupabaseWithUser = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: mockUserId, email: "owner@delhispice.in" } },
        error: null,
      })),
    },
  };

  const mockSupabaseUnauth = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: null },
        error: { message: "No active session" },
      })),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSiteAction", () => {
    it("returns UNAUTHENTICATED error when session is absent", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseUnauth as unknown as SupabaseClient<Database>,
      );

      const result = await getSiteAction(mockBusinessId);
      expect(result.success).toBe(false);
      expect(result).toMatchObject({
        code: "UNAUTHENTICATED",
        error: "Authentication required",
      });
    });

    it("returns site data for authenticated user", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );
      vi.mocked(getSiteByBusinessId).mockResolvedValue({ id: mockSiteId } as unknown as SiteRow);

      const result = await getSiteAction(mockBusinessId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ id: mockSiteId });
      }
    });

    it("sanitizes WebsiteError properly", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );
      vi.mocked(getSiteByBusinessId).mockRejectedValue(
        new WebsiteError("Tenant forbidden", "FORBIDDEN", 403),
      );

      const result = await getSiteAction(mockBusinessId);
      expect(result.success).toBe(false);
      expect(result).toMatchObject({
        code: "FORBIDDEN",
        error: "Tenant forbidden",
      });
    });
  });

  describe("getSiteConfigurationAction", () => {
    it("returns UNAUTHENTICATED when caller is not signed in", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseUnauth as unknown as SupabaseClient<Database>,
      );

      const result = await getSiteConfigurationAction(mockSiteId);
      expect(result.success).toBe(false);
      expect(result).toMatchObject({
        code: "UNAUTHENTICATED",
      });
    });

    it("returns version and configuration for authorized user", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );
      vi.mocked(getSiteConfiguration).mockResolvedValue({
        version: { id: "ver-1", version_number: 1 } as unknown as SiteVersionRow,
        configuration: sampleConfig,
      });

      const result = await getSiteConfigurationAction(mockSiteId, 1);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version.version_number).toBe(1);
        expect(result.data.configuration.schemaVersion).toBe("v1");
      }
    });
  });

  describe("saveSiteDraftConfigurationAction", () => {
    it("returns UNAUTHENTICATED when caller is not signed in", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseUnauth as unknown as SupabaseClient<Database>,
      );

      const result = await saveSiteDraftConfigurationAction({
        siteId: mockSiteId,
        configuration: sampleConfig,
        expectedBaseVersionNumber: 1,
      });
      expect(result.success).toBe(false);
      expect(result).toMatchObject({
        code: "UNAUTHENTICATED",
      });
    });

    it("returns VALIDATION_FAILED when schema validation fails", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );

      const invalidInput = {
        siteId: "not-a-uuid",
        configuration: {} as unknown as WebsiteConfiguration,
        expectedBaseVersionNumber: 1,
      };

      const result = await saveSiteDraftConfigurationAction(invalidInput);
      expect(result.success).toBe(false);
      expect(result).toMatchObject({
        code: "VALIDATION_FAILED",
      });
      if (!result.success) {
        expect(result.validationErrors).toBeDefined();
        expect(result.validationErrors?.siteId).toBeDefined();
      }
    });

    it("returns VALIDATION_FAILED when expectedBaseVersionNumber is omitted (prevent bypass)", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );

      const missingVersionInput = {
        siteId: mockSiteId,
        configuration: sampleConfig,
      };

      const result = await saveSiteDraftConfigurationAction(
        missingVersionInput as unknown as SaveSiteDraftInput,
      );
      expect(result.success).toBe(false);
      expect(result).toMatchObject({
        code: "VALIDATION_FAILED",
      });
      if (!result.success) {
        expect(result.validationErrors).toBeDefined();
        expect(result.validationErrors?.expectedBaseVersionNumber).toBeDefined();
      }
    });

    it("successfully saves initial draft with explicit null expectedBaseVersionNumber", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );
      vi.mocked(saveSiteDraftConfiguration).mockResolvedValue({
        site: { id: mockSiteId, current_draft_version_id: "ver-1" } as unknown as SiteRow,
        version: { id: "ver-1", version_number: 1 } as unknown as SiteVersionRow,
        configuration: sampleConfig,
      });

      const result = await saveSiteDraftConfigurationAction({
        siteId: mockSiteId,
        configuration: sampleConfig,
        changeSummary: "Initial starter draft",
        expectedBaseVersionNumber: null,
      });

      expect(result.success).toBe(true);
      expect(saveSiteDraftConfiguration).toHaveBeenCalledWith(
        mockSupabaseWithUser,
        mockUserId,
        expect.objectContaining({
          siteId: mockSiteId,
          expectedBaseVersionNumber: null,
        }),
      );
    });

    it("successfully saves draft configuration and triggers path revalidation", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        mockSupabaseWithUser as unknown as SupabaseClient<Database>,
      );
      vi.mocked(saveSiteDraftConfiguration).mockResolvedValue({
        site: { id: mockSiteId, current_draft_version_id: "ver-2" } as unknown as SiteRow,
        version: { id: "ver-2", version_number: 2 } as unknown as SiteVersionRow,
        configuration: sampleConfig,
      });

      const result = await saveSiteDraftConfigurationAction({
        siteId: mockSiteId,
        configuration: sampleConfig,
        changeSummary: "Draft updated via editor",
        expectedBaseVersionNumber: 1,
      });

      expect(result.success).toBe(true);
      expect(saveSiteDraftConfiguration).toHaveBeenCalledWith(
        mockSupabaseWithUser,
        mockUserId,
        expect.objectContaining({
          siteId: mockSiteId,
          changeSummary: "Draft updated via editor",
          expectedBaseVersionNumber: 1,
        }),
      );
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/website");
      expect(revalidatePath).toHaveBeenCalledWith("/workspace/clients");
    });
  });
});
