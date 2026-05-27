"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Camera, Clock, Check, XCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVENT_PHOTO_MAX_SIZE_BYTES,
  EVENT_PHOTO_MAX_SIZE_MB,
  eventPhotoSizeLimitError,
  isEventPhotoImageFile,
} from "@/lib/constants/event-photo-upload";
import { prepareEventPhotoFile } from "@/lib/utils/prepare-event-photo-file";
import type { EventPhoto, PhotoStatus } from "@/types";

interface PhotoUploadClientProps {
  eventId: string;
  eventSlug: string;
  initialPhotos: EventPhoto[];
  initialGalleryPhotos: EventPhoto[];
}

type PreviewFile = { file: File; url: string };

const PHOTOS_PER_PAGE = 24;

export function PhotoUploadClient({
  eventId,
  eventSlug,
  initialPhotos,
  initialGalleryPhotos,
}: PhotoUploadClientProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [galleryPhotos, setGalleryPhotos] = useState(initialGalleryPhotos);
  const [galleryPage, setGalleryPage] = useState(0);
  const [expandedPhoto, setExpandedPhoto] = useState<EventPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    setError(null);

    const nextPreviews: PreviewFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (!isEventPhotoImageFile(file.name, file.type)) {
        errors.push(`${file.name}: unsupported file type`);
        continue;
      }

      if (file.size > EVENT_PHOTO_MAX_SIZE_BYTES) {
        errors.push(eventPhotoSizeLimitError(file.name));
        continue;
      }

      nextPreviews.push({ file, url: URL.createObjectURL(file) });
    }

    if (nextPreviews.length > 0) {
      setPreviewFiles((prev) => [...prev, ...nextPreviews]);
    }

    if (errors.length > 0) {
      setError(errors.join(" · "));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (previewFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setUploadProgress({ current: 0, total: previewFiles.length });

    const failedPreviews: PreviewFile[] = [];
    const errors: string[] = [];
    try {
      for (let i = 0; i < previewFiles.length; i++) {
        const preview = previewFiles[i];
        setUploadProgress({ current: i + 1, total: previewFiles.length });

        try {
          const preparedFile = await prepareEventPhotoFile(preview.file);
          const formData = new FormData();
          formData.append("file", preparedFile);
          formData.append("eventId", eventId);
          if (caption.trim()) {
            formData.append("caption", caption.trim());
          }

          const res = await fetch("/api/upload-event-photo", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            failedPreviews.push(preview);
            errors.push(data.error || `Failed to upload ${preview.file.name}`);
            continue;
          }

          setPhotos((prev) => [data.photo, ...prev]);
          setGalleryPhotos((prev) => [data.photo, ...prev]);
          URL.revokeObjectURL(preview.url);
        } catch {
          failedPreviews.push(preview);
          errors.push(`Failed to upload ${preview.file.name}`);
        }
      }

      setPreviewFiles(failedPreviews);
      if (failedPreviews.length === 0) {
        setCaption("");
      }
      if (errors.length > 0) {
        setError(errors.join(" · "));
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const removePreview = (index: number) => {
    setPreviewFiles((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const cancelPreview = () => {
    previewFiles.forEach((preview) => URL.revokeObjectURL(preview.url));
    setPreviewFiles([]);
    setCaption("");
    setError(null);
  };

  const galleryTotalPages = Math.max(1, Math.ceil(galleryPhotos.length / PHOTOS_PER_PAGE));
  const paginatedGalleryPhotos = useMemo(() => {
    const start = galleryPage * PHOTOS_PER_PAGE;
    return galleryPhotos.slice(start, start + PHOTOS_PER_PAGE);
  }, [galleryPhotos, galleryPage]);

  const totalPreviewSizeMb = previewFiles.reduce((sum, preview) => sum + preview.file.size, 0) / (1024 * 1024);

  const statusConfig = (status: PhotoStatus) => {
    switch (status) {
      case "pending":
        return { icon: Clock, label: "Pending Review", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
      case "approved":
        return { icon: Check, label: "Approved", color: "text-green-400 bg-green-400/10 border-green-400/20" };
      case "rejected":
        return { icon: XCircle, label: "Not Approved", color: "text-red-400 bg-red-400/10 border-red-400/20" };
    }
  };

  return (
    <div className="space-y-8">
      {/* Upload area */}
      {previewFiles.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "glass rounded-3xl border-2 border-dashed p-12 text-center cursor-pointer transition-all",
            dragOver
              ? "border-white/40 bg-white/10"
              : "border-white/10 hover:border-white/20 hover:bg-white/5"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files);
              }
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-white/80 font-medium">
                Drop photos here or click to browse
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mt-2">
                PNG, JPEG, WebP, GIF, HEIC up to {EVENT_PHOTO_MAX_SIZE_MB}MB each
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl border border-white/10 overflow-hidden">
          <div className={cn(
            "grid gap-2 bg-black/50 p-3",
            previewFiles.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
          )}>
            {previewFiles.map((preview, index) => (
              <div key={`${preview.file.name}-${preview.url}`} className="relative aspect-square overflow-hidden rounded-2xl bg-black/50">
                <Image
                  src={preview.url}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 256px"
                />
                <button
                  onClick={() => removePreview(index)}
                  disabled={uploading}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-all disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="p-6 space-y-4">
            <input
              type="text"
              placeholder={previewFiles.length > 1 ? "Add a caption to all photos (optional)" : "Add a caption (optional)"}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-colors"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-600">
                {previewFiles.length} photo{previewFiles.length !== 1 ? "s" : ""} · {totalPreviewSizeMb.toFixed(1)}MB total
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={cancelPreview}
                  disabled={uploading}
                  className="px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold bg-white text-black hover:bg-white/90 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {uploading
                    ? uploadProgress
                      ? `Uploading ${uploadProgress.current}/${uploadProgress.total}`
                      : "Uploading..."
                    : `Submit ${previewFiles.length} Photo${previewFiles.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Community gallery */}
      <div className="space-y-4">
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-bold">
            All Event Photos ({galleryPhotos.length})
          </h2>
          <p className="mt-2 text-xs text-gray-600">
            Photos uploaded by attendees for this event.
          </p>
        </div>

        {galleryPhotos.length === 0 ? (
          <div className="glass rounded-3xl border border-white/10 p-10 text-center">
            <Camera className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No photos have been uploaded yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {paginatedGalleryPhotos.map((photo) => {
                const config = statusConfig(photo.status as PhotoStatus);
                const StatusIcon = config.icon;
                return (
                  <div
                    key={photo.id}
                    className="glass rounded-2xl border border-white/10 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedPhoto(photo)}
                      className="relative block w-full aspect-square"
                    >
                      <Image
                        src={photo.file_url}
                        alt={photo.caption || "Event photo"}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                      <div className={cn(
                        "absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.15em] font-bold border",
                        config.color
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </div>
                    </button>
                    {(photo.caption || photo.uploader?.name || photo.created_at) && (
                      <div className="p-3 space-y-1">
                        {photo.caption && (
                          <p className="text-xs text-gray-400 line-clamp-2">{photo.caption}</p>
                        )}
                        <p className="text-[10px] text-gray-600">
                          {photo.uploader?.name || "Attendee"}
                          <span className="mx-1">·</span>
                          {new Date(photo.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {galleryTotalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 tabular-nums">
                  Page {galleryPage + 1} of {galleryTotalPages}
                  <span className="mx-2 text-gray-700">·</span>
                  {galleryPhotos.length} photo{galleryPhotos.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
                    disabled={galleryPage === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-all hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="hidden sm:flex items-center gap-1.5 max-w-[280px] overflow-x-auto py-1">
                    {Array.from({ length: galleryTotalPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setGalleryPage(i)}
                        className={cn(
                          "h-1.5 shrink-0 rounded-full transition-all",
                          i === galleryPage ? "w-4 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                        )}
                        aria-label={`Go to page ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGalleryPage((p) => Math.min(galleryTotalPages - 1, p + 1))}
                    disabled={galleryPage >= galleryTotalPages - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-all hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* My submissions */}
      {photos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-bold">
            Your Submissions ({photos.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => {
              const config = statusConfig(photo.status as PhotoStatus);
              const StatusIcon = config.icon;
              return (
                <div
                  key={photo.id}
                  className="glass rounded-2xl border border-white/10 overflow-hidden"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={photo.file_url}
                      alt={photo.caption || "Your photo"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                    <div className={cn(
                      "absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.15em] font-bold border",
                      config.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </div>
                  {photo.caption && (
                    <div className="p-3">
                      <p className="text-xs text-gray-400 line-clamp-2">{photo.caption}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setExpandedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
              aria-label="Close photo"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden">
              <Image
                src={expandedPhoto.file_url}
                alt={expandedPhoto.caption || "Event photo"}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>
            {(expandedPhoto.caption || expandedPhoto.uploader?.name || expandedPhoto.created_at) && (
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  {expandedPhoto.caption && (
                    <p className="text-sm text-gray-300">{expandedPhoto.caption}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {expandedPhoto.uploader?.name || "Attendee"}
                    <span className="mx-1">·</span>
                    {new Date(expandedPhoto.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={cn(
                  "shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] uppercase tracking-[0.15em] font-bold border",
                  statusConfig(expandedPhoto.status as PhotoStatus).color
                )}>
                  {expandedPhoto.status}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
