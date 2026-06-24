"use client";

import { useState, useTransition, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Check, X, Trash2, CheckCheck, ImageIcon, Filter, Upload, Loader2, Archive, Star, ChevronLeft, ChevronRight } from "lucide-react";
import JSZip from "jszip";
import { approvePhoto, rejectPhoto, deletePhoto, bulkApprovePhotos, toggleHeroFeatured } from "@/lib/actions/photos";
import {
  EVENT_PHOTO_MAX_SIZE_BYTES,
  EVENT_PHOTO_MAX_SIZE_MB,
  eventPhotoSizeLimitError,
  getEventPhotoMimeType,
  isEventPhotoImageFile,
} from "@/lib/constants/event-photo-upload";
import {
  parseJsonResponse,
  prepareEventPhotoFile,
  sleep,
  withUploadRetries,
} from "@/lib/utils/prepare-event-photo-file";
import { cn } from "@/lib/utils";
import type { Event, EventPhoto, PhotoStatus } from "@/types";

interface PhotosAdminTabProps {
  event: Event;
  adminCode: string;
  initialPhotos: EventPhoto[];
  initialHeroFeaturedIds?: string[];
}

type FilterStatus = "all" | PhotoStatus;

const PHOTOS_PER_PAGE = 24;

function isTeamIconPhoto(photo: EventPhoto) {
  return photo.photo_usage === "hackathon_team_icon";
}

export function PhotosAdminTab({
  event,
  adminCode,
  initialPhotos,
  initialHeroFeaturedIds = [],
}: PhotosAdminTabProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [heroFeaturedIds, setHeroFeaturedIds] = useState<Set<string>>(new Set(initialHeroFeaturedIds));

  // Admin upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageFile = (name: string, type?: string) => isEventPhotoImageFile(name, type);

  const getMimeType = (name: string) => getEventPhotoMimeType(name);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  useEffect(() => {
    setHeroFeaturedIds(new Set(initialHeroFeaturedIds));
  }, [initialHeroFeaturedIds]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-event-photos-${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_photos", filter: `event_id=eq.${event.id}` }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, router]);

  const extractImagesFromZip = async (file: File): Promise<File[]> => {
    const zip = await JSZip.loadAsync(file);
    const imageFiles: File[] = [];

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const fileName = path.split("/").pop() || path;
      if (fileName.startsWith(".") || fileName.startsWith("__")) continue;
      if (!isImageFile(fileName)) continue;

      const blob = await entry.async("blob");
      if (blob.size > EVENT_PHOTO_MAX_SIZE_BYTES) continue;
      const imageFile = new File([blob], fileName, { type: getMimeType(fileName) });
      imageFiles.push(imageFile);
    }

    return imageFiles;
  };

  const uploadSingleFile = async (file: File): Promise<EventPhoto | null> => {
    const preparedFile = await prepareEventPhotoFile(file);

    return withUploadRetries(async () => {
      const signRes = await fetch("/api/admin/event-photo-upload/sign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-code": adminCode,
          "x-event-id": event.id,
        },
        body: JSON.stringify({
          fileName: preparedFile.name,
          contentType: preparedFile.type || getMimeType(preparedFile.name),
          size: preparedFile.size,
        }),
      });

      const signed = await parseJsonResponse<{ error?: string; bucket: string; path: string; token: string; publicUrl: string; contentType?: string }>(signRes);
      if (!signRes.ok) {
        throw new Error(signed.error || `Failed to prepare ${preparedFile.name}`);
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, preparedFile, {
          contentType: signed.contentType || preparedFile.type || getMimeType(preparedFile.name),
        });

      if (uploadError) {
        throw new Error(`Upload failed for ${preparedFile.name}: ${uploadError.message}`);
      }

      const completeRes = await fetch("/api/admin/event-photo-upload/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-code": adminCode,
          "x-event-id": event.id,
        },
        body: JSON.stringify({
          path: signed.path,
          publicUrl: signed.publicUrl,
          autoApprove: true,
        }),
      });

      const data = await parseJsonResponse<{ error?: string; photo?: EventPhoto }>(completeRes);
      if (completeRes.ok && data.photo) return data.photo;
      throw new Error(data.error || `Failed to save ${preparedFile.name}`);
    });
  };

  const handleAdminUpload = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    setUploading(true);
    setUploadProgress(null);

    const fileArray = Array.from(files);
    const imagesToUpload: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
        try {
          const extracted = await extractImagesFromZip(file);
          if (extracted.length === 0) {
            errors.push(`${file.name}: No images found in ZIP`);
          } else {
            imagesToUpload.push(...extracted);
          }
        } catch {
          errors.push(`${file.name}: Failed to read ZIP file`);
        }
      } else if (isImageFile(file.name, file.type)) {
        if (file.size > EVENT_PHOTO_MAX_SIZE_BYTES) {
          errors.push(eventPhotoSizeLimitError(file.name));
        } else {
          imagesToUpload.push(file);
        }
      } else {
        errors.push(`${file.name}: Unsupported file type`);
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.slice(0, 5).join(" · ") + (errors.length > 5 ? ` · …and ${errors.length - 5} more` : ""));
    }

    if (imagesToUpload.length === 0) {
      setUploading(false);
      return;
    }

    setUploadProgress({ current: 0, total: imagesToUpload.length });
    const results: EventPhoto[] = [];

    for (let i = 0; i < imagesToUpload.length; i++) {
      setUploadProgress({ current: i + 1, total: imagesToUpload.length });
      try {
        const photo = await uploadSingleFile(imagesToUpload[i]);
        if (photo) {
          results.push(photo);
          setPhotos((prev) => [photo, ...prev]);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Failed to upload ${imagesToUpload[i].name}`);
        setUploadError(errors.slice(0, 5).join(" · ") + (errors.length > 5 ? ` · …and ${errors.length - 5} more` : ""));
      }
      await sleep(120);
    }

    setUploading(false);
    setUploadProgress(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminCode, event.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleAdminUpload(e.dataTransfer.files);
    }
  }, [handleAdminUpload]);

  const filteredPhotos = useMemo(() => {
    const matchingPhotos = filter === "all"
      ? photos
      : photos.filter((p) => p.status === filter);

    return [...matchingPhotos].sort((a, b) => {
      const aFeatured = heroFeaturedIds.has(a.id);
      const bFeatured = heroFeaturedIds.has(b.id);
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filter, heroFeaturedIds, photos]);

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / PHOTOS_PER_PAGE));

  const paginatedPhotos = useMemo(() => {
    const start = page * PHOTOS_PER_PAGE;
    return filteredPhotos.slice(start, start + PHOTOS_PER_PAGE);
  }, [filteredPhotos, page]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const pendingCount = photos.filter((p) => p.status === "pending").length;
  const approvedCount = photos.filter((p) => p.status === "approved").length;
  const rejectedCount = photos.filter((p) => p.status === "rejected").length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const pendingFiltered = filteredPhotos.filter((p) => p.status === "pending");
    const allSelected = pendingFiltered.every((p) => selectedIds.has(p.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map((p) => p.id)));
    }
  };

  const handleApprove = (photoId: string) => {
    startTransition(async () => {
      const result = await approvePhoto(photoId, event.id, adminCode);
      if (result.success) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? { ...p, status: "approved" as const, reviewed_at: new Date().toISOString() }
              : p
          )
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(photoId);
          return next;
        });
      }
    });
  };

  const handleReject = (photoId: string) => {
    startTransition(async () => {
      const result = await rejectPhoto(photoId, event.id, adminCode);
      if (result.success) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? { ...p, status: "rejected" as const, reviewed_at: new Date().toISOString() }
              : p
          )
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(photoId);
          return next;
        });
      }
    });
  };

  const handleDelete = (photoId: string) => {
    startTransition(async () => {
      const result = await deletePhoto(photoId, event.id, adminCode);
      if (result.success) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(photoId);
          return next;
        });
        if (expandedPhoto === photoId) setExpandedPhoto(null);
      }
    });
  };

  const handleBulkApprove = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkApprovePhotos(ids, event.id, adminCode);
      if (result.success) {
        setPhotos((prev) =>
          prev.map((p) =>
            selectedIds.has(p.id)
              ? { ...p, status: "approved" as const, reviewed_at: new Date().toISOString() }
              : p
          )
        );
        setSelectedIds(new Set());
      }
    });
  };

  const handleToggleHeroFeatured = (photoId: string) => {
    startTransition(async () => {
      const result = await toggleHeroFeatured(photoId, event.id, adminCode);
      if (result.success) {
        setHeroFeaturedIds((prev) => {
          const next = new Set(prev);
          if (result.featured) next.add(photoId);
          else next.delete(photoId);
          return next;
        });
      }
    });
  };

  const heroCount = heroFeaturedIds.size;

  const FILTERS: Array<{ id: FilterStatus; label: string; count: number }> = [
    { id: "all", label: "All", count: photos.length },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "approved", label: "Approved", count: approvedCount },
    { id: "rejected", label: "Rejected", count: rejectedCount },
  ];

  const statusColor = (status: PhotoStatus) => {
    switch (status) {
      case "pending": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case "approved": return "text-green-400 bg-green-400/10 border-green-400/20";
      case "rejected": return "text-red-400 bg-red-400/10 border-red-400/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "glass rounded-3xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
          dragOver
            ? "border-white/40 bg-white/10"
            : "border-white/10 hover:border-white/20 hover:bg-white/5"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,.zip,application/zip"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleAdminUpload(e.target.files);
            }
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
              {uploadProgress && (
                <p className="text-xs text-gray-400 tabular-nums">
                  {uploadProgress.current} / {uploadProgress.total}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Upload className="w-8 h-8 text-gray-500" />
              <Archive className="w-6 h-6 text-gray-600" />
            </div>
          )}
          <div>
            <p className="text-sm text-white/80 font-medium">
              {uploading
                ? uploadProgress
                  ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`
                  : "Extracting..."
                : "Drop photos or a ZIP file here, or click to upload"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mt-1">
              Auto-approved · Multiple files or ZIP archives · PNG, JPEG, WebP, GIF, HEIC · {EVENT_PHOTO_MAX_SIZE_MB}MB per image
            </p>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="glass rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-sm text-red-400">{uploadError}</p>
        </div>
      )}

      {/* Hero gallery indicator */}
      {heroCount > 0 && (
        <div className="glass rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <p className="text-sm text-amber-300">
            <span className="font-bold">{heroCount}</span> photo{heroCount !== 1 ? "s" : ""} featured in the hero gallery on the homepage
          </p>
        </div>
      )}

      {/* Filter chips + bulk actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setSelectedIds(new Set()); setPage(0); }}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all border",
                filter === f.id
                  ? "bg-white/10 text-white border-white/20"
                  : "text-gray-500 border-transparent hover:text-white hover:bg-white/5"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-gray-600">{f.count}</span>
            </button>
          ))}
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllFiltered}
              className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 hover:text-white transition-colors"
            >
              {filteredPhotos.filter((p) => p.status === "pending").every((p) => selectedIds.has(p.id))
                ? "Deselect All"
                : "Select All Pending"}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Approve {selectedIds.size}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Photo grid */}
      {filteredPhotos.length === 0 ? (
        <div className="glass rounded-3xl p-16 border-white/10 text-center">
          <ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            {filter === "all"
              ? "No photos uploaded yet. Attendees can submit photos from the event portal."
              : `No ${filter} photos.`}
          </p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {paginatedPhotos.map((photo) => (
            <div
              key={photo.id}
              className={cn(
                "group relative glass rounded-2xl border overflow-hidden transition-all",
                selectedIds.has(photo.id)
                  ? "border-white/40 ring-1 ring-white/20"
                  : "border-white/10 hover:border-white/20"
              )}
            >
              {/* Selection checkbox for pending photos */}
              {photo.status === "pending" && (
                <button
                  onClick={() => toggleSelect(photo.id)}
                  className={cn(
                    "absolute top-2 left-2 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                    selectedIds.has(photo.id)
                      ? "bg-white border-white"
                      : "border-white/40 bg-black/40 opacity-0 group-hover:opacity-100"
                  )}
                >
                  {selectedIds.has(photo.id) && (
                    <Check className="w-4 h-4 text-black" />
                  )}
                </button>
              )}

              <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
                <div className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.15em] font-bold border",
                  statusColor(photo.status as PhotoStatus)
                )}>
                  {photo.status}
                </div>
                {isTeamIconPhoto(photo) && (
                  <div className="rounded-full border border-blue-400/20 bg-blue-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-blue-200">
                    Team icon
                  </div>
                )}
              </div>

              {/* Hero featured star */}
              {photo.status === "approved" && !isTeamIconPhoto(photo) && (
                <button
                  onClick={() => handleToggleHeroFeatured(photo.id)}
                  disabled={isPending}
                  className={cn(
                    "absolute top-2 left-2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-50",
                    heroFeaturedIds.has(photo.id)
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-black/40 text-white/30 border border-white/10 opacity-0 group-hover:opacity-100 hover:text-amber-400"
                  )}
                  title={heroFeaturedIds.has(photo.id) ? "Remove from hero gallery" : "Feature in hero gallery"}
                >
                  <Star className={cn("w-3.5 h-3.5", heroFeaturedIds.has(photo.id) && "fill-amber-400")} />
                </button>
              )}

              {/* Image */}
              <button
                onClick={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)}
                className="w-full aspect-square relative"
              >
                <Image
                  src={photo.file_url}
                  alt={photo.caption || "Event photo"}
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </button>

              {/* Info + actions */}
              <div className="p-3 space-y-2">
                {photo.caption && (
                  <p className="text-xs text-gray-400 line-clamp-2">{photo.caption}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-600">
                    {photo.uploader?.name || "Unknown"}
                    <span className="mx-1">·</span>
                    {new Date(photo.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    {photo.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(photo.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50"
                          title="Approve"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReject(photo.id)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="Reject"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(photo.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 tabular-nums">
              Page {page + 1} of {totalPages}
              <span className="mx-2 text-gray-700">·</span>
              {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-all hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="hidden sm:flex items-center gap-1.5 max-w-[280px] overflow-x-auto py-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(i)}
                    className={cn(
                      "h-1.5 shrink-0 rounded-full transition-all",
                      i === page ? "w-4 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                    )}
                    aria-label={`Go to page ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
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

      {/* Expanded photo modal */}
      {expandedPhoto && (() => {
        const photo = photos.find((p) => p.id === expandedPhoto);
        if (!photo) return null;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setExpandedPhoto(null)}
          >
            <div
              className="relative max-w-4xl max-h-[85vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedPhoto(null)}
                className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden">
                <Image
                  src={photo.file_url}
                  alt={photo.caption || "Event photo"}
                  fill
                  className="object-contain"
                  sizes="100vw"
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  {isTeamIconPhoto(photo) && (
                    <span className="mb-2 inline-flex rounded-full border border-blue-400/20 bg-blue-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
                      Team icon submission
                    </span>
                  )}
                  {photo.caption && (
                    <p className="text-sm text-gray-300 mb-1">{photo.caption}</p>
                  )}
                  <p className="text-[10px] text-gray-500">
                    Uploaded by {photo.uploader?.name || "Unknown"} · {new Date(photo.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {photo.status === "approved" && !isTeamIconPhoto(photo) && (
                    <button
                      onClick={() => handleToggleHeroFeatured(photo.id)}
                      disabled={isPending}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold border transition-all disabled:opacity-50",
                        heroFeaturedIds.has(photo.id)
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                          : "bg-white/5 text-gray-400 border-white/10 hover:text-amber-400 hover:border-amber-500/20"
                      )}
                    >
                      <Star className={cn("w-3.5 h-3.5", heroFeaturedIds.has(photo.id) && "fill-amber-400")} />
                      {heroFeaturedIds.has(photo.id) ? "Featured" : "Feature"}
                    </button>
                  )}
                  {photo.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(photo.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(photo.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(photo.id)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
