"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { createAgendaItem, updateAgendaItem, deleteAgendaItem, getEventsForImport, importAgendaFromEvent, applyAgendaTemplate } from "@/lib/actions/agenda";
import type { Event, AgendaItem } from "@/types";
import { Plus, Trash2, Edit2, Clock, MapPin, User, Check, Download } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { readFileToBlob } from "@/lib/utils/read-file";

// Convert UTC ISO string to datetime-local format in MST
function utcToMstLocal(utcString: string): string {
  const date = new Date(utcString);
  const mstDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Edmonton" }));
  const year = mstDate.getFullYear();
  const month = String(mstDate.getMonth() + 1).padStart(2, "0");
  const day = String(mstDate.getDate()).padStart(2, "0");
  const hours = String(mstDate.getHours()).padStart(2, "0");
  const minutes = String(mstDate.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Get timezone offset in milliseconds for a given timezone
function getTimezoneOffset(timezone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

interface AgendaAdminClientProps {
  event: Event;
  eventSlug: string;
  initialItems: AgendaItem[];
  adminCode?: string;
}

export function AgendaAdminClient({
  event,
  eventSlug,
  initialItems,
  adminCode,
}: AgendaAdminClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  // Sync list from server when initialItems changes (e.g. after router.refresh() so image_url updates show)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleDelete = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this agenda item?")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteAgendaItem(itemId, eventSlug);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        router.refresh();
      } else {
        setError(result.error || "Failed to delete agenda item");
      }
    });
  };

  const handleCreate = async (data: {
    title: string;
    description?: string;
    location?: string;
    speaker?: string;
    start_time?: string;
    end_time?: string;
    image_url?: string;
  }) => {
    setError(null);
    startTransition(async () => {
      const result = await createAgendaItem(event.id, eventSlug, data);
      if (result.success) {
        router.refresh();
        setShowCreateModal(false);
      } else {
        setError(result.error || "Failed to create agenda item");
      }
    });
  };

  const handleApplyTemplate = () => {
    setError(null);
    startTransition(async () => {
      const result = await applyAgendaTemplate(event.id, eventSlug, adminCode ?? event.admin_code);
      if ("success" in result) {
        router.refresh();
      } else {
        setError(result.error || "Failed to apply template");
      }
    });
  };

  const handleUpdate = async (itemId: string, data: Partial<AgendaItem>) => {
    setError(null);
    startTransition(async () => {
      const result = await updateAgendaItem(itemId, eventSlug, data);
      if (result.success) {
        router.refresh();
        setEditingItem(null);
      } else {
        setError(result.error || "Failed to update agenda item");
      }
    });
  };


  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <AdminHeader 
        eventSlug={eventSlug} 
        subtitle="Agenda Management"
        rightElement={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
              title="Import from previous event"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all shadow-xl"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12 animate-fade-in">
        {/* Error Message */}
        {error && (
          <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Agenda Items */}
        {items.length === 0 ? (
          <div className="glass rounded-[40px] border-dashed border-white/5 p-10 text-center space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
                No agenda items yet
              </p>
              <p className="text-xs text-gray-700 mt-1">
                Start with the standard meetup template and tweak from there.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
              <button
                onClick={handleApplyTemplate}
                disabled={isPending}
                className="h-12 px-6 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
              >
                {isPending ? "Adding..." : "Insert Template"}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                disabled={isPending}
                className="h-12 px-6 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                Import From Event
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={isPending}
                className="h-12 px-6 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                Add Manually
              </button>
            </div>
            <p className="text-[10px] text-gray-700 tracking-wide pt-1">
              Template times use the event date in {event.timezone || "America/Edmonton"}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center px-2 pb-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </p>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="glass rounded-[32px] p-8 border-white/[0.03] hover:bg-white/[0.01] transition-all"
              >
                {item.image_url && (
                  <div className="w-full h-32 rounded-2xl overflow-hidden border border-white/10 mb-5">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      {item.start_time && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-600 uppercase tracking-[0.2em]">
                          <Clock className="w-3 h-3" />
                          {formatTime(item.start_time, event.timezone || "America/Edmonton")}
                          {item.end_time && ` – ${formatTime(item.end_time, event.timezone || "America/Edmonton")}`}
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-light tracking-tight text-white/90">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-6 text-[10px] text-gray-700">
                      {item.speaker && (
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          {item.speaker}
                        </div>
                      )}
                      {item.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditingItem(item)}
                      disabled={isPending}
                      className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-600 hover:text-white hover:border-white/20 transition-all flex items-center justify-center"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-800 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <div className="flex items-center gap-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Agenda</p>
        </div>
      </footer>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingItem) && (
        <CreateEditModal
          item={editingItem}
          eventId={event.id}
          adminCode={adminCode ?? event.admin_code}
          onClose={() => {
            setShowCreateModal(false);
            setEditingItem(null);
          }}
          onCreate={handleCreate}
          onUpdate={editingItem ? (data) => handleUpdate(editingItem.id, data) : undefined}
          isPending={isPending}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          targetEventId={event.id}
          targetEventSlug={eventSlug}
          adminCode={adminCode ?? event.admin_code}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

type SourceEvent = { id: string; name: string; slug: string; start_time: string | null; items: AgendaItem[] };

interface ImportModalProps {
  targetEventId: string;
  targetEventSlug: string;
  adminCode?: string | null;
  onClose: () => void;
  onImported: () => void;
}

function ImportModal({ targetEventId, targetEventSlug, adminCode, onClose, onImported }: ImportModalProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SourceEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SourceEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEventsForImport(targetEventId, adminCode).then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, [targetEventId, adminCode]);

  const selectEvent = (ev: SourceEvent) => {
    setSelectedEvent(ev);
    setSelectedIds(new Set(ev.items.map((i) => i.id)));
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!selectedEvent || selectedIds.size === 0) return;
    setImporting(true);
    setError(null);
    const result = await importAgendaFromEvent(
      selectedEvent.id,
      targetEventId,
      targetEventSlug,
      Array.from(selectedIds),
      adminCode
    );
    if ("success" in result && result.success) {
      onImported();
    } else {
      setError(("error" in result && result.error) || "Import failed");
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass rounded-[40px] p-10 space-y-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-light text-white">Import Agenda</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mt-1">
              {selectedEvent ? "Select items to copy" : "Choose a source event"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center text-white"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : !selectedEvent ? (
          events.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">No other events have agenda items yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => selectEvent(ev)}
                  className="w-full text-left glass rounded-[24px] px-6 py-5 border-white/[0.03] hover:bg-white/[0.04] transition-all"
                >
                  <p className="text-white font-light">{ev.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mt-1">
                    {ev.items.length} item{ev.items.length !== 1 ? "s" : ""}
                    {ev.start_time && ` · ${new Date(ev.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  </p>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-all"
            >
              ← Back to events
            </button>

            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">
                {selectedIds.size} of {selectedEvent.items.length} selected
              </p>
              <button
                onClick={() =>
                  selectedIds.size === selectedEvent.items.length
                    ? setSelectedIds(new Set())
                    : setSelectedIds(new Set(selectedEvent.items.map((i) => i.id)))
                }
                className="text-[10px] uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-all"
              >
                {selectedIds.size === selectedEvent.items.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div className="space-y-3">
              {selectedEvent.items.map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full text-left glass rounded-[24px] px-6 py-5 border transition-all flex items-start gap-4 ${
                      checked ? "border-white/20 bg-white/[0.04]" : "border-white/[0.03] opacity-50"
                    }`}
                  >
                    <div
                      className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all ${
                        checked ? "bg-white border-white" : "border-white/20"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-light">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-700 uppercase tracking-[0.15em]">
                        {item.speaker && <span>{item.speaker}</span>}
                        {item.location && <span>{item.location}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-700 tracking-wide">
              Times will be cleared — update them after import.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleImport}
                disabled={importing || selectedIds.size === 0}
                className="flex-1 h-14 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
              >
                {importing ? "Importing..." : `Import ${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-8 h-14 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CreateEditModalProps {
  item: AgendaItem | null;
  eventId: string;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description?: string;
    location?: string;
    speaker?: string;
    start_time?: string;
    end_time?: string;
    image_url?: string;
  }) => void;
  onUpdate?: (data: Partial<AgendaItem>) => void;
  isPending: boolean;
  adminCode?: string;
}

function CreateEditModal({
  item,
  eventId,
  onClose,
  onCreate,
  onUpdate,
  isPending,
  adminCode,
}: CreateEditModalProps) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [location, setLocation] = useState(item?.location || "");
  const [speaker, setSpeaker] = useState(item?.speaker || "");
  const [startTime, setStartTime] = useState(
    item?.start_time ? utcToMstLocal(item.start_time) : ""
  );
  const [endTime, setEndTime] = useState(
    item?.end_time ? utcToMstLocal(item.end_time) : ""
  );
  const [imageUrl, setImageUrl] = useState(item?.image_url || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    try {
      const blob = await readFileToBlob(file);

      const formData = new FormData();
      formData.append("file", blob, file.name);
      formData.append("eventId", eventId);

      const headers: Record<string, string> = { "x-event-id": eventId };
      if (adminCode) headers["x-admin-code"] = adminCode;

      const response = await fetch("/api/admin/upload-agenda-image", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      if (data.success && data.url) {
        setImageUrl(data.url);
      } else {
        throw new Error("Failed to upload image");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload image";
      setError(errorMessage);
    } finally {
      setUploadingImage(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    // Convert MST local times to UTC for storage
    let startTimeUtc: string | undefined;
    let endTimeUtc: string | undefined;

    if (startTime) {
      // Parse datetime-local value as MST and convert to UTC
      const [datePart, timePart] = startTime.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);
      // Create date assuming the input is in MST
      const localDate = new Date(year, month - 1, day, hours, minutes);
      const offset = getTimezoneOffset("America/Edmonton", localDate);
      startTimeUtc = new Date(localDate.getTime() + offset).toISOString();
    }

    if (endTime) {
      const [datePart, timePart] = endTime.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes);
      const offset = getTimezoneOffset("America/Edmonton", localDate);
      endTimeUtc = new Date(localDate.getTime() + offset).toISOString();
    }

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      speaker: speaker.trim() || undefined,
      start_time: startTimeUtc,
      end_time: endTimeUtc,
      image_url: imageUrl.trim() || undefined,
    };

    if (item && onUpdate) {
      onUpdate(data);
    } else {
      onCreate(data);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass rounded-[40px] p-10 space-y-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light text-white">
            {item ? "Edit Agenda Item" : "Create Agenda Item"}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
              placeholder="e.g., Welcome & Introductions"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all resize-none"
              placeholder="Additional details about this agenda item..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                Speaker/Host
              </label>
              <input
                type="text"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
                placeholder="e.g., Jia Ming Huang"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
                placeholder="e.g., Main Hall"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
              Image
            </label>
            <div className="space-y-3">
              {imageUrl && (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={imageUrl}
                    alt="Agenda preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all"
                  >
                    ×
                  </button>
                </div>
              )}
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage || isPending}
                  className="hidden"
                />
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center text-sm">
                  {uploadingImage ? "Uploading..." : imageUrl ? "Change Image" : "Upload Image"}
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-14 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl"
            >
              {isPending ? "..." : item ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-8 h-14 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 disabled:opacity-30 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

