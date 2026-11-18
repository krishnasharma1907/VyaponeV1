import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MediaUploader } from "@/components/media/media-uploader";
import * as mediaActions from "@/lib/media/actions";

vi.mock("@/lib/media/actions", () => ({
  requestUploadAuthorizationAction: vi.fn(),
  finalizeMediaUploadAction: vi.fn(),
}));

describe("VO-032 MediaUploader Component (WCAG 2.2 AA & UX)", () => {
  const businessId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-preview");
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  it("renders with accessible label, hint, and aria attributes", () => {
    render(
      <MediaUploader
        businessId={businessId}
        category="business_logo"
        label="Store Logo"
        hint="Upload high-res PNG or JPEG"
      />,
    );

    expect(screen.getByText("Store Logo")).toBeDefined();
    expect(screen.getByText("Upload high-res PNG or JPEG")).toBeDefined();

    const dropzone = screen.getByRole("button", { name: /upload store logo/i });
    expect(dropzone).toBeDefined();
    expect(dropzone.getAttribute("tabIndex")).toBe("0");
    expect(dropzone.getAttribute("aria-busy")).toBe("false");
  });

  it("performs immediate client pre-validation when file exceeds size limit", async () => {
    const onUploadError = vi.fn();
    render(
      <MediaUploader
        businessId={businessId}
        category="business_logo"
        label="Store Logo"
        onUploadError={onUploadError}
      />,
    );

    // Business logo limit is 2 MB. Create a 3 MB file.
    const file = new File([new Uint8Array(3 * 1024 * 1024)], "oversized.png", {
      type: "image/png",
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Alert container should appear with actionable message
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("exceeds the maximum allowed 2 MB");
    expect(onUploadError).toHaveBeenCalledWith(
      expect.stringContaining("exceeds the maximum allowed 2 MB"),
    );

    // Server actions should NOT have been invoked
    expect(mediaActions.requestUploadAuthorizationAction).not.toHaveBeenCalled();
  });

  it("performs immediate client pre-validation when file type is unsupported", async () => {
    const onUploadError = vi.fn();
    render(
      <MediaUploader
        businessId={businessId}
        category="business_logo"
        label="Store Logo"
        onUploadError={onUploadError}
      />,
    );

    // Business logo allows image/png, image/jpeg, image/webp, image/svg+xml. Upload PDF.
    const file = new File([new Uint8Array(1024)], "contract.pdf", {
      type: "application/pdf",
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('File format "application/pdf" is not supported');
    expect(mediaActions.requestUploadAuthorizationAction).not.toHaveBeenCalled();
  });

  it("completes full direct upload lifecycle on valid file selection", async () => {
    const onUploadSuccess = vi.fn();

    vi.mocked(mediaActions.requestUploadAuthorizationAction).mockResolvedValue({
      success: true,
      data: {
        mediaId: "media-uuid-1",
        businessId,
        category: "business_logo",
        objectKey: `tenants/${businessId}/business_logo/media-uuid-1.png`,
        bucket: "vyapone-public-media",
        uploadUrl: "https://storage.vyapone.local/upload/signed-put-url",
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      },
    });

    vi.mocked(mediaActions.finalizeMediaUploadAction).mockResolvedValue({
      success: true,
      data: {
        id: "media-uuid-1",
        businessId,
        workspaceId: null,
        uploadedBy: "user-1",
        category: "business_logo",
        bucket: "vyapone-public-media",
        objectKey: `tenants/${businessId}/business_logo/media-uuid-1.png`,
        originalFilename: "valid-logo.png",
        declaredContentType: "image/png",
        detectedContentType: "image/png",
        fileSizeBytes: 1024 * 50,
        width: 800,
        height: 600,
        isPublic: false,
        status: "ready",
        metadata: {},
        expiresAt: null,
        verifiedAt: new Date().toISOString(),
        publishedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: "https://cdn.vyapone.com/vyapone-public-media/logo.png",
      },
    });

    render(
      <MediaUploader
        businessId={businessId}
        category="business_logo"
        label="Store Logo"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const file = new File([new Uint8Array(1024 * 50)], "valid-logo.png", {
      type: "image/png",
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText("Upload verified and ready!")).toBeDefined();
    });

    expect(mediaActions.requestUploadAuthorizationAction).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://storage.vyapone.local/upload/signed-put-url",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mediaActions.finalizeMediaUploadAction).toHaveBeenCalledWith({
      businessId,
      mediaId: "media-uuid-1",
    });

    expect(onUploadSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "media-uuid-1",
        status: "ready",
        width: 800,
        height: 600,
      }),
    );
  });

  it("supports keyboard activation via Enter and Space keys", () => {
    render(<MediaUploader businessId={businessId} category="business_logo" label="Store Logo" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    const dropzone = screen.getByRole("button", { name: /upload store logo/i });
    fireEvent.keyDown(dropzone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dropzone, { key: " " });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });
});
