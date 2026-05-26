"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Camera, Clock, Check, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVENT_PHOTO_MAX_SIZE_BYTES,
  EVENT_PHOTO_MAX_SIZE_MB,
  eventPhotoSizeLimitError,
} from "@/lib/constants/event-photo-upload";
import type { EventPhoto, PhotoStatus } from "@/types";

interface PhotoUploadClientProps {
  eventId: string;
  eventSlug: string;
  initialPhotos: EventPhoto[];
}

type PreviewFile = { file: File; url: string };

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function isImageFile(file: File) {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function PhotoUploadClient({
  eventId,
  eventSlug,
  initialPhotos,
}: PhotoUploadClientProps) {
  const [photos, setPhotos] = useState(initialPhotos);
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
      if (!isImageFile(file)) {
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
          const formData = new FormData();
          formData.append("file", preview.file);
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
                PNG, JPEG, WebP, GIF up to {EVENT_PHOTO_MAX_SIZE_MB}MB each
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
    </div>
  );
}
