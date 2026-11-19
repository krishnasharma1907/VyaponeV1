import { beforeEach, describe, expect, it } from "vitest";
import {
  clearWizardDraft,
  DRAFT_PREFIX,
  DRAFT_TTL_MS,
  getDraftStorageKey,
  loadWizardDraft,
  MAX_CLOCK_SKEW_MS,
  restoreDraftFormData,
  sanitizeAnswersForStorage,
  sanitizeDraftForStorage,
  sanitizeMediaPreviewUrl,
  sanitizeMediaPreviewUrls,
  saveWizardDraft,
} from "@/components/businesses/create-business-wizard/draft-storage";
import type { WizardFormData } from "@/components/businesses/create-business-wizard/types";

describe("VO-033 Secure Draft Storage & Privacy Tests", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const otherUserId = "22222222-2222-4222-8222-222222222222";
  const workspaceId = "33333333-3333-4333-8333-333333333333";
  const otherWorkspaceId = "44444444-4444-4444-8444-444444444444";

  const sampleFormData: WizardFormData = {
    niche_slug: "cafe",
    niche_group_slug: "food_hospitality",
    niche_name: "Café & Bakery",
    trade_name: "Artisan Coffee Roasters",
    legal_name: "Artisan Coffee Private Limited",
    slug: "artisan-coffee-roasters",
    description: "Specialty brew bar and cafe",
    location_name: "Main Roastery",
    address_line1: "100ft Road, Indiranagar",
    address_line2: "Near Metro",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560038",
    primary_phone: "+919876543210",
    whatsapp_number: "+919876543210",
    email: "roastery@artisancoffee.in",
    gst_number: "29AAAAA0000A1Z5", // Sensitive statutory tax identifier
    pan_number: "ABCDE1234F", // Sensitive statutory tax identifier
    tax_scheme: "registered",
    logo_media_id: "media-uuid-1",
    logo_preview_url: "https://example.com/logo.png",
    showcase_media_ids: ["media-uuid-2"],
    showcase_preview_urls: ["https://example.com/showcase.png"],
    onboarding_answers: {
      has_outdoor_seating: true,
      seating_capacity: 45,
      gst_registration_state: "KA", // Nested sensitive property name
      pan_holder_name: "John Doe", // Nested sensitive property name
      owner_secret_code: "xyz-123", // Nested sensitive property name
    },
    businessId: null,
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("1. Key Scoping and Fail-Closed Null Checks", () => {
    it("scopes storage key to both authenticated userId and workspaceId", () => {
      const key = getDraftStorageKey(userId, workspaceId);
      expect(key).toBe(`${DRAFT_PREFIX}${userId}:${workspaceId}`);
    });

    it("fails closed (returns null) when userId is missing, null, or empty", () => {
      expect(getDraftStorageKey(null, workspaceId)).toBeNull();
      expect(getDraftStorageKey(undefined, workspaceId)).toBeNull();
      expect(getDraftStorageKey("", workspaceId)).toBeNull();
      expect(getDraftStorageKey("   ", workspaceId)).toBeNull();
    });

    it("fails closed (returns null) when workspaceId is missing, null, or empty", () => {
      expect(getDraftStorageKey(userId, null)).toBeNull();
      expect(getDraftStorageKey(userId, undefined)).toBeNull();
      expect(getDraftStorageKey(userId, "")).toBeNull();
      expect(getDraftStorageKey(userId, "   ")).toBeNull();
    });

    it("saveWizardDraft fails closed and does not write when identity is missing", () => {
      const res1 = saveWizardDraft(null, workspaceId, sampleFormData, 2);
      expect(res1).toBe(false);
      expect(window.localStorage.length).toBe(0);

      const res2 = saveWizardDraft(userId, null, sampleFormData, 2);
      expect(res2).toBe(false);
      expect(window.localStorage.length).toBe(0);
    });

    it("loadWizardDraft fails closed and returns null when identity is missing", () => {
      expect(loadWizardDraft(null, workspaceId)).toBeNull();
      expect(loadWizardDraft(userId, null)).toBeNull();
    });
  });

  describe("2. Statutory Identifiers & Sensitive Field Privacy", () => {
    it("explicitly strips pan_number and gst_number from persisted draft", () => {
      const safe = sanitizeDraftForStorage(sampleFormData);
      expect((safe as unknown as Record<string, unknown>).pan_number).toBeUndefined();
      expect((safe as unknown as Record<string, unknown>).gst_number).toBeUndefined();
    });

    it("never serializes PAN or GSTIN to localStorage", () => {
      saveWizardDraft(userId, workspaceId, sampleFormData, 2);
      const key = getDraftStorageKey(userId, workspaceId)!;
      const raw = window.localStorage.getItem(key);
      expect(raw).not.toBeNull();
      expect(raw).not.toContain("ABCDE1234F"); // PAN value
      expect(raw).not.toContain("29AAAAA0000A1Z5"); // GSTIN value
      expect(raw).not.toContain('"pan_number"');
      expect(raw).not.toContain('"gst_number"');
    });

    it("recursively sanitizes nested dynamic answers containing sensitive keys", () => {
      const sanitized = sanitizeAnswersForStorage(sampleFormData.onboarding_answers);
      expect(sanitized.has_outdoor_seating).toBe(true);
      expect(sanitized.seating_capacity).toBe(45);
      expect(sanitized.gst_registration_state).toBeUndefined();
      expect(sanitized.pan_holder_name).toBeUndefined();
      expect(sanitized.owner_secret_code).toBeUndefined();
    });

    it("restores draft form data with empty strings for statutory tax identifiers", () => {
      const safe = sanitizeDraftForStorage(sampleFormData);
      const restored = restoreDraftFormData(safe);
      expect(restored.pan_number).toBe("");
      expect(restored.gst_number).toBe("");
      expect(restored.trade_name).toBe("Artisan Coffee Roasters");
      expect(restored.city).toBe("Bengaluru");
    });
  });

  describe("2b. Media Preview URLs and Token Privacy (Gate B)", () => {
    it("strips transient blob: URLs from persisted drafts", () => {
      expect(sanitizeMediaPreviewUrl("blob:http://localhost:3000/1234-5678")).toBeNull();
      expect(
        sanitizeMediaPreviewUrls([
          "blob:http://localhost:3000/1",
          "https://example.com/valid.png",
          "blob:http://localhost:3000/2",
        ]),
      ).toEqual(["https://example.com/valid.png"]);
    });

    it("strips signed URLs containing tokens, signatures, or secret query params", () => {
      expect(
        sanitizeMediaPreviewUrl(
          "https://storage.supabase.co/object/sign/private/logo.png?token=eyJhbGciOi...",
        ),
      ).toBeNull();
      expect(
        sanitizeMediaPreviewUrl(
          "https://storage.supabase.co/object/sign/private/logo.png?signature=abc",
        ),
      ).toBeNull();
      expect(
        sanitizeMediaPreviewUrl(
          "https://storage.supabase.co/object/sign/private/logo.png?apikey=key123",
        ),
      ).toBeNull();
    });

    it("preserves clean token-free public URLs", () => {
      expect(sanitizeMediaPreviewUrl("https://cdn.example.com/images/store-logo.jpg")).toBe(
        "https://cdn.example.com/images/store-logo.jpg",
      );
    });

    it("sanitizes media preview URLs during saveWizardDraft", () => {
      const dataWithSensitiveUrls: WizardFormData = {
        ...sampleFormData,
        logo_preview_url: "blob:http://localhost:3000/local-blob",
        showcase_preview_urls: [
          "https://storage.supabase.co/sign/showcase.jpg?token=secret123",
          "https://cdn.example.com/clean.jpg",
        ],
      };
      const safe = sanitizeDraftForStorage(dataWithSensitiveUrls);
      expect(safe.logo_preview_url).toBeNull();
      expect(safe.showcase_preview_urls).toEqual(["https://cdn.example.com/clean.jpg"]);
    });
  });

  describe("3. Expiry, Malformed Timestamps, and Clock Skew", () => {
    it("loads valid unexpired draft within TTL successfully", () => {
      saveWizardDraft(userId, workspaceId, sampleFormData, 3);
      const loaded = loadWizardDraft(userId, workspaceId);
      expect(loaded).not.toBeNull();
      expect(loaded?.step).toBe(3);
      expect(loaded?.data.trade_name).toBe("Artisan Coffee Roasters");
      expect(loaded?.data.pan_number).toBe("");
    });

    it("rejects and deletes draft when savedAt timestamp is older than DRAFT_TTL_MS (24h)", () => {
      const key = getDraftStorageKey(userId, workspaceId)!;
      const expiredTime = new Date(Date.now() - DRAFT_TTL_MS - 1000).toISOString();
      const expiredDraft = {
        version: "1.0",
        step: 2,
        data: sanitizeDraftForStorage(sampleFormData),
        savedAt: expiredTime,
        userId,
        workspaceId,
      };
      window.localStorage.setItem(key, JSON.stringify(expiredDraft));

      const loaded = loadWizardDraft(userId, workspaceId);
      expect(loaded).toBeNull();
      // Verifies expired draft is evicted from localStorage
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("rejects and deletes draft when savedAt timestamp is malformed", () => {
      const key = getDraftStorageKey(userId, workspaceId)!;
      const malformedDraft = {
        version: "1.0",
        step: 2,
        data: sanitizeDraftForStorage(sampleFormData),
        savedAt: "invalid-date-format-xyz",
        userId,
        workspaceId,
      };
      window.localStorage.setItem(key, JSON.stringify(malformedDraft));

      const loaded = loadWizardDraft(userId, workspaceId);
      expect(loaded).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("rejects and deletes draft when savedAt timestamp is in future beyond clock-skew tolerance", () => {
      const key = getDraftStorageKey(userId, workspaceId)!;
      const futureTime = new Date(Date.now() + MAX_CLOCK_SKEW_MS + 60000).toISOString();
      const futureDraft = {
        version: "1.0",
        step: 2,
        data: sanitizeDraftForStorage(sampleFormData),
        savedAt: futureTime,
        userId,
        workspaceId,
      };
      window.localStorage.setItem(key, JSON.stringify(futureDraft));

      const loaded = loadWizardDraft(userId, workspaceId);
      expect(loaded).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });
  });

  describe("4. Cross-User and Cross-Workspace Isolation", () => {
    it("User A cannot load User B's draft on the same browser", () => {
      saveWizardDraft(userId, workspaceId, sampleFormData, 2);

      // Other user tries to load from the same workspace
      const otherUserDraft = loadWizardDraft(otherUserId, workspaceId);
      expect(otherUserDraft).toBeNull();

      // Original user draft is untouched
      const originalDraft = loadWizardDraft(userId, workspaceId);
      expect(originalDraft).not.toBeNull();
    });

    it("Draft from Workspace A does not leak into Workspace B for the same user", () => {
      saveWizardDraft(userId, workspaceId, sampleFormData, 2);

      // Same user views a different workspace
      const otherWsDraft = loadWizardDraft(userId, otherWorkspaceId);
      expect(otherWsDraft).toBeNull();

      // Original workspace draft is untouched
      const originalDraft = loadWizardDraft(userId, workspaceId);
      expect(originalDraft).not.toBeNull();
    });

    it("clearWizardDraft removes only the draft matching user and workspace", () => {
      saveWizardDraft(userId, workspaceId, sampleFormData, 2);
      saveWizardDraft(userId, otherWorkspaceId, sampleFormData, 3);

      clearWizardDraft(userId, workspaceId);

      expect(loadWizardDraft(userId, workspaceId)).toBeNull();
      expect(loadWizardDraft(userId, otherWorkspaceId)).not.toBeNull();
    });
  });
});
