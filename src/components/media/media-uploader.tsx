"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  finalizeMediaUploadAction,
  publishMediaItemAction,
  requestUploadAuthorizationAction,
} from "@/lib/media/actions";
import type { MediaItem } from "@/lib/media/types";
import { CATEGORY_CONSTRAINTS, type MediaCategory } from "@/lib/media/validation";

export interface MediaUploaderProps {
  businessId: string;
  category: MediaCategory;
  label?: string;
  hint?: string;
  initialMediaUrl?: string;
  autoPublish?: boolean;
  onUploadSuccess?: (item: MediaItem) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

export type UploadState =
  "idle" | "authorizing" | "uploading" | "verifying" | "ready_private" | "published" | "error";

export function MediaUploader({
  businessId,
  category,
  label,
  hint,
  initialMediaUrl,
  autoPublish = false,
  onUploadSuccess,
  onUploadError,
  className = "",
}: MediaUploaderProps): React.JSX.Element {
  const constraints = CATEGORY_CONSTRAINTS[category];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialMediaUrl ?? null);
  const [uploadedItem, setUploadedItem] = useState<MediaItem | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const inputId = `media-uploader-input-${category}`;
  const hintId = `media-uploader-hint-${category}`;
  const errorId = `media-uploader-error-${category}`;

  const resetState = useCallback(() => {
    setState("idle");
    setErrorMessage(null);
    setProgressPercent(0);
    setUploadedItem(null);
    setPreviewUrl(initialMediaUrl ?? null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [initialMediaUrl]);

  const handleFileProcess = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      // 1. Client-Side Pre-Validation: File Size
      if (file.size <= 0) {
        const err = "Selected file is empty.";
        setErrorMessage(err);
        setState("error");
        onUploadError?.(err);
        return;
      }

      if (file.size > constraints.maxSizeBytes) {
        const maxMb = Math.round(constraints.maxSizeBytes / (1024 * 1024));
        const actualMb = (file.size / (1024 * 1024)).toFixed(2);
        const err = `File size (${actualMb} MB) exceeds the maximum allowed ${maxMb} MB for ${constraints.description}.`;
        setErrorMessage(err);
        setState("error");
        onUploadError?.(err);
        return;
      }

      // 2. Client-Side Pre-Validation: Declared MIME Type
      const normalizedMime = file.type.toLowerCase().trim();
      if (normalizedMime && !constraints.allowedMimeTypes.includes(normalizedMime)) {
        const allowedList = constraints.allowedMimeTypes
          .map((m) => m.replace("image/", "").replace("application/", ""))
          .join(", ");
        const err = `File format "${file.type}" is not supported for ${constraints.description}. Please upload: ${allowedList}.`;
        setErrorMessage(err);
        setState("error");
        onUploadError?.(err);
        return;
      }

      // Generate local preview if image and browser supports createObjectURL
      if (file.type.startsWith("image/") && typeof URL.createObjectURL === "function") {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      }

      try {
        // Phase 1: Authorize upload to private quarantine
        setState("authorizing");
        setProgressPercent(15);

        const authResult = await requestUploadAuthorizationAction({
          businessId,
          category,
          filename: file.name,
          fileSizeBytes: file.size,
          contentType: file.type || "application/octet-stream",
        });

        if (!authResult.success || !authResult.data) {
          throw new Error(authResult.error ?? "Failed to authorize upload");
        }

        const { uploadUrl, mediaId, headers } = authResult.data;

        // Phase 2: Direct-to-storage upload (strictly to private quarantine)
        setState("uploading");
        setProgressPercent(45);

        const uploadHeaders: Record<string, string> = {
          "Content-Type": file.type || "application/octet-stream",
          ...(headers ?? {}),
        };

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: uploadHeaders,
        });

        if (!uploadResponse.ok) {
          throw new Error(
            `Direct storage upload failed with HTTP status ${uploadResponse.status}.`,
          );
        }

        // Phase 3: Finalize and verify uploaded bytes on server
        setState("verifying");
        setProgressPercent(80);

        const finalizeResult = await finalizeMediaUploadAction({
          businessId,
          mediaId,
        });

        if (!finalizeResult.success || !finalizeResult.data) {
          throw new Error(finalizeResult.error ?? "File verification failed on server");
        }

        let item = finalizeResult.data;
        setUploadedItem(item);
        if (item.url) {
          setPreviewUrl(item.url);
        }

        // Phase 4: Optional auto-publish if requested and category is publishable
        if (autoPublish && constraints.isPublishable) {
          const pubResult = await publishMediaItemAction({
            businessId,
            mediaId: item.id,
          });
          if (pubResult.success && pubResult.data) {
            item = pubResult.data;
            setUploadedItem(item);
            if (item.url) {
              setPreviewUrl(item.url);
            }
            setProgressPercent(100);
            setState("published");
            onUploadSuccess?.(item);
            return;
          }
        }

        setProgressPercent(100);
        setState("ready_private");
        onUploadSuccess?.(item);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unexpected upload error occurred.";
        setErrorMessage(msg);
        setState("error");
        onUploadError?.(msg);
      }
    },
    [autoPublish, businessId, category, constraints, onUploadError, onUploadSuccess],
  );

  const handlePublish = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!uploadedItem || !constraints.isPublishable) return;
      setIsPublishing(true);
      try {
        const pubResult = await publishMediaItemAction({
          businessId,
          mediaId: uploadedItem.id,
        });
        if (!pubResult.success || !pubResult.data) {
          throw new Error(pubResult.error ?? "Failed to publish media item.");
        }
        const item = pubResult.data;
        setUploadedItem(item);
        if (item.url) {
          setPreviewUrl(item.url);
        }
        setState("published");
        onUploadSuccess?.(item);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publication failed.";
        setErrorMessage(msg);
        setState("error");
        onUploadError?.(msg);
      } finally {
        setIsPublishing(false);
      }
    },
    [businessId, constraints.isPublishable, onUploadError, onUploadSuccess, uploadedItem],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleZoneClick = (e?: React.MouseEvent) => {
    if (e?.target === fileInputRef.current) {
      return;
    }
    if (
      state !== "authorizing" &&
      state !== "uploading" &&
      state !== "verifying" &&
      !isPublishing
    ) {
      fileInputRef.current?.click();
    }
  };

  const handleZoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleZoneClick();
    }
  };

  const isBusy =
    state === "authorizing" || state === "uploading" || state === "verifying" || isPublishing;

  const isCompleted = state === "ready_private" || state === "published";

  return (
    <div className={`vyapone-media-uploader flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </label>
      )}

      {hint && (
        <p id={hintId} className="text-xs text-gray-600 dark:text-gray-400">
          {hint}
        </p>
      )}

      {/* Accessible dropzone */}
      <div
        role="button"
        tabIndex={isBusy ? -1 : 0}
        aria-label={`Upload ${label ?? constraints.description}. Click or drag file here.`}
        aria-describedby={hint ? hintId : undefined}
        aria-busy={isBusy}
        onClick={handleZoneClick}
        onKeyDown={handleZoneKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
          isDragOver
            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
        } ${isBusy ? "cursor-not-allowed opacity-75" : ""}`}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={constraints.allowedMimeTypes.join(",")}
          onChange={handleInputChange}
          disabled={isBusy}
          className="sr-only"
        />

        {previewUrl && (
          <div className="mb-3 flex max-h-32 items-center justify-center overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Media Preview"
              className="max-h-28 max-w-full rounded object-contain"
            />
          </div>
        )}

        {!isBusy && !isCompleted && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Drag and drop your file here, or{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">browse</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max {Math.round(constraints.maxSizeBytes / (1024 * 1024))} MB (
              {constraints.allowedMimeTypes
                .map((m) => m.replace("image/", "").replace("application/", ""))
                .join(", ")}
              )
            </p>
          </div>
        )}

        {isBusy && (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              {state === "authorizing" && "Authorizing secure upload..."}
              {state === "uploading" && `Uploading to storage (${progressPercent}%)...`}
              {state === "verifying" && "Verifying content and dimensions..."}
              {isPublishing && "Publishing asset to web..."}
            </p>
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            >
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {state === "ready_private" && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Upload verified and ready!
            </p>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              Private (Quarantine)
            </span>
            {uploadedItem && (
              <p className="text-xs text-gray-500">
                {uploadedItem.originalFilename} ({(uploadedItem.fileSizeBytes / 1024).toFixed(1)}{" "}
                KB)
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {constraints.isPublishable && (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="inline-flex items-center rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  Publish Asset
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetState();
                }}
                className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Replace File
              </button>
            </div>
          </div>
        )}

        {state === "published" && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Published and publicly accessible!
            </p>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Public
            </span>
            {uploadedItem && (
              <p className="text-xs text-gray-500">
                {uploadedItem.originalFilename} ({(uploadedItem.fileSizeBytes / 1024).toFixed(1)}{" "}
                KB)
              </p>
            )}
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetState();
                }}
                className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Replace File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Accessible Error Container */}
      {errorMessage && (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="rounded-md bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
