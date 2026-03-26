"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Camera, Clock, Check, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPhoto, PhotoStatus } from "@/types";

interface PhotoUploadClientProps {
  eventId: string;
  eventSlug: string;
  initialPhotos: EventPhoto[];
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
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only image files are supported (PNG, JPEG, WebP, GIF)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewFile({ file, url });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!previewFile) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", previewFile.file);
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
        setError(data.error || "Upload failed");
        return;
      }

      setPhotos((prev) => [data.photo, ...prev]);
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
      setCaption("");
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const cancelPreview = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
    setCaption("");
    setError(null);
  };

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
      {!previewFile ? (
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
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-white/80 font-medium">
                Drop a photo here or click to browse
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mt-2">
                PNG, JPEG, WebP, GIF up to 10MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl border border-white/10 overflow-hidden">
          <div className="relative aspect-video">
            <Image
              src={previewFile.url}
              alt="Preview"
              fill
              className="object-contain bg-black/50"
              sizes="(max-width: 768px) 100vw, 768px"
            />
            <button
              onClick={cancelPreview}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <input
              type="text"
              placeholder="Add a caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-colors"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-600">
                {previewFile.file.name} · {(previewFile.file.size / (1024 * 1024)).toFixed(1)}MB
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={cancelPreview}
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
                  {uploading ? "Uploading..." : "Submit Photo"}
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
