"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, X, Trash2, CheckCheck, ImageIcon, Filter } from "lucide-react";
import { approvePhoto, rejectPhoto, deletePhoto, bulkApprovePhotos } from "@/lib/actions/photos";
import { cn } from "@/lib/utils";
import type { Event, EventPhoto, PhotoStatus } from "@/types";

interface PhotosAdminTabProps {
  event: Event;
  adminCode: string;
  initialPhotos: EventPhoto[];
}

type FilterStatus = "all" | PhotoStatus;

export function PhotosAdminTab({
  event,
  adminCode,
  initialPhotos,
}: PhotosAdminTabProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const filteredPhotos = filter === "all"
    ? photos
    : photos.filter((p) => p.status === filter);

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
      {/* Filter chips + bulk actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setSelectedIds(new Set()); }}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredPhotos.map((photo) => (
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

              {/* Status badge */}
              <div className={cn(
                "absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.15em] font-bold border",
                statusColor(photo.status as PhotoStatus)
              )}>
                {photo.status}
              </div>

              {/* Image */}
              <button
                onClick={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)}
                className="w-full aspect-square relative"
              >
                <Image
                  src={photo.file_url}
                  alt={photo.caption || "Event photo"}
                  fill
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
                  {photo.caption && (
                    <p className="text-sm text-gray-300 mb-1">{photo.caption}</p>
                  )}
                  <p className="text-[10px] text-gray-500">
                    Uploaded by {photo.uploader?.name || "Unknown"} · {new Date(photo.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
