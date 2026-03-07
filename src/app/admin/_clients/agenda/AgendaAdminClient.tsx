"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { createAgendaItem, updateAgendaItem, deleteAgendaItem, updateEventDetails } from "@/lib/actions/agenda";
import { updateVenue } from "@/lib/actions/event-dashboard";
import type { Event, AgendaItem, Venue } from "@/types";
import { ArrowLeft, Plus, Trash2, Edit2, Clock, MapPin, User, Image, Settings, Check, Building2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { formatTime } from "@/lib/utils";

function venueNameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

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
  adminCode?: string;
  initialItems: AgendaItem[];
  venues: Venue[];
}

export function AgendaAdminClient({
  event,
  eventSlug,
  adminCode,
  initialItems,
  venues,
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
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showVenuePresets, setShowVenuePresets] = useState(false);
  const [venuesList, setVenuesList] = useState<Venue[]>(venues);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(venues[0]?.id ?? "");
  const [eventName, setEventName] = useState(event.name);
  const [eventVenue, setEventVenue] = useState(event.venue || "");
  const [eventAddress, setEventAddress] = useState(event.address || "");
  const [eventStartTime, setEventStartTime] = useState(
    event.start_time ? utcToMstLocal(event.start_time) : ""
  );
  const [eventEndTime, setEventEndTime] = useState(
    event.end_time ? utcToMstLocal(event.end_time) : ""
  );
  const [venueImageUrl, setVenueImageUrl] = useState(event.venue_image_url || "");
  const [uploadingVenueImage, setUploadingVenueImage] = useState(false);
  const [eventDetailsSaved, setEventDetailsSaved] = useState(false);

  const handleVenueImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVenueImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch("/api/admin/upload-venue-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      if (data.success && data.url) {
        const newUrl = data.url as string;
        setVenueImageUrl(newUrl);
        // Save to the shared venues record so Calendar picks it up too
        if (selectedVenueId) {
          const result = await updateVenue(selectedVenueId, { image_url: newUrl });
          if (!result.error) {
            setVenuesList((prev) =>
              prev.map((v) => (v.id === selectedVenueId ? { ...v, image_url: newUrl } : v))
            );
          }
        }
      } else {
        throw new Error("Failed to upload image");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload image";
      setError(errorMessage);
    } finally {
      setUploadingVenueImage(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSaveEventDetails = async () => {
    setError(null);
    startTransition(async () => {
      let startTimeUtc: string | null = null;
      let endTimeUtc: string | null = null;

      if (eventStartTime) {
        const [datePart, timePart] = eventStartTime.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = timePart.split(":").map(Number);
        const localDate = new Date(year, month - 1, day, hours, minutes);
        const offset = getTimezoneOffset("America/Edmonton", localDate);
        startTimeUtc = new Date(localDate.getTime() + offset).toISOString();
      }

      if (eventEndTime) {
        const [datePart, timePart] = eventEndTime.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = timePart.split(":").map(Number);
        const localDate = new Date(year, month - 1, day, hours, minutes);
        const offset = getTimezoneOffset("America/Edmonton", localDate);
        endTimeUtc = new Date(localDate.getTime() + offset).toISOString();
      }

      const result = await updateEventDetails(event.id, eventSlug, {
        name: eventName.trim(),
        venue: eventVenue.trim() || null,
        address: eventAddress.trim() || null,
        start_time: startTimeUtc,
        end_time: endTimeUtc,
        venue_image_url: venueImageUrl.trim() || null,
      });

      if (result.success) {
        setEventDetailsSaved(true);
        setTimeout(() => setEventDetailsSaved(false), 2000);
        router.refresh();
      } else {
        setError(result.error || "Failed to update event details");
      }
    });
  };

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

  const handleInitAgenda = async (force = false) => {
    const selectedVenue = venuesList.find((v) => v.id === selectedVenueId);
    const template = venueNameToSlug(selectedVenue?.name ?? "");
    const confirmMsg = force
      ? "This will DELETE all existing agenda items and replace them with the template. Continue?"
      : "This will create agenda items from the selected template. Continue?";
    if (!confirm(confirmMsg)) return;

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/init-agenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventSlug, adminCode, template, force }),
        });

        if (response.ok) {
          router.refresh();
        } else {
          const errorData = await response.json().catch(() => ({ error: "Failed to initialize agenda" }));
          setError(errorData.error || "Failed to initialize agenda");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
      }
    });
  };

  return (
    <div className="min-h-screen bg-black-gradient text-white pb-20">
      <AdminHeader 
        eventSlug={eventSlug} 
        subtitle="Agenda Management"
        rightElement={
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all shadow-xl"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12 animate-fade-in">
        {/* Error Message */}
        {error && (
          <div className="glass rounded-[32px] p-6 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Event Details */}
        <div className="glass rounded-[32px] border-white/[0.03] overflow-hidden">
          <button
            onClick={() => setShowEventDetails(!showEventDetails)}
            className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/[0.01] transition-all"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                Event Details
              </span>
            </div>
            <span className="text-gray-600 text-sm">{showEventDetails ? "−" : "+"}</span>
          </button>
          {showEventDetails && (
            <div className="px-8 pb-8 space-y-5 border-t border-white/[0.03] pt-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                  Event Name
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
                />
              </div>
              {/* Venue Presets */}
              <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowVenuePresets(!showVenuePresets)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                      Venue Presets
                    </span>
                    {selectedVenueId && (
                      <span className="text-[9px] text-gray-600 normal-case tracking-normal">
                        — {venuesList.find((v) => v.id === selectedVenueId)?.name}
                      </span>
                    )}
                  </div>
                  {showVenuePresets ? (
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  )}
                </button>
                {showVenuePresets && (
                  <div className="px-5 pb-5 pt-3 border-t border-white/[0.04] space-y-3">
                    <p className="text-[10px] text-gray-600 leading-relaxed">
                      Select a venue to auto-fill details below. Image, address and agenda template are all linked.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {venuesList.map((v) => {
                        const isSelected = selectedVenueId === v.id;
                        return (
                          <div
                            key={v.id}
                            className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 h-44 ${
                              isSelected
                                ? "ring-2 ring-white/60 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
                                : "ring-1 ring-white/[0.06] hover:ring-white/20"
                            }`}
                            onClick={() => {
                              setSelectedVenueId(v.id);
                              setEventVenue(v.name);
                              setEventAddress(v.address || "");
                              setVenueImageUrl(v.image_url || "");
                            }}
                          >
                            {v.image_url ? (
                              <img
                                src={v.image_url}
                                alt={v.name}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 transition-opacity duration-300" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-white/[0.04] pointer-events-none" />
                            )}
                            <div className="relative z-10 h-full flex flex-col justify-between p-4">
                              <div className="flex justify-end">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shadow-lg ${
                                    isSelected
                                      ? "border-white bg-white"
                                      : "border-white/30 group-hover:border-white/60 bg-black/30 backdrop-blur-sm"
                                  }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-base font-medium text-white tracking-tight leading-tight">{v.name}</p>
                                <div className="flex items-start gap-1.5 transition-all duration-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
                                  <MapPin className="w-3 h-3 text-white/50 flex-shrink-0 mt-0.5" />
                                  <p className="text-[10px] text-white/55 leading-snug">{v.address}</p>
                                </div>
                                <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] transition-colors group-hover:text-white/50">{v.city}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-gray-700 pt-1">
                      Fills in venue & address below. Click <strong className="text-gray-600">Save Details</strong> to persist.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={eventVenue}
                    onChange={(e) => setEventVenue(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
                    placeholder="e.g., House 831"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={eventAddress}
                    onChange={(e) => setEventAddress(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 transition-all"
                    placeholder="e.g., 831 17 Ave SW, Calgary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                  Venue Image
                </label>
                <div className="space-y-3">
                  {venueImageUrl && (
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/10">
                      <img
                        src={venueImageUrl}
                        alt="Venue preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setVenueImageUrl("")}
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
                      onChange={handleVenueImageUpload}
                      disabled={uploadingVenueImage || isPending}
                      className="hidden"
                    />
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white hover:bg-white/10 transition-all cursor-pointer text-center text-sm">
                      {uploadingVenueImage ? "Uploading..." : venueImageUrl ? "Change Image" : "Upload Image"}
                    </div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                    Event Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
                    Event End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveEventDetails}
                disabled={isPending}
                className="h-12 px-8 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl flex items-center gap-2"
              >
                {eventDetailsSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : isPending ? "..." : "Save Details"}
              </button>
            </div>
          )}
        </div>

        {/* Agenda Items */}
        {items.length === 0 ? (
          <div className="glass rounded-[40px] border-dashed border-white/5 p-10 space-y-8">
            <div className="text-center space-y-2">
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-gray-600">
                No agenda items yet
              </p>
              <p className="text-xs text-gray-700">Select a venue to initialize the agenda</p>
            </div>
            {/* Venue image cards */}
            <div className="grid grid-cols-2 gap-4">
              {venuesList.map((v) => {
                const isSelected = selectedVenueId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 h-48 ${
                      isSelected
                        ? "ring-2 ring-white/60 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                        : "ring-1 ring-white/[0.06] hover:ring-white/20"
                    }`}
                    onClick={() => {
                      setSelectedVenueId(v.id);
                      setEventVenue(v.name);
                      setEventAddress(v.address || "");
                      setVenueImageUrl(v.image_url || "");
                    }}
                  >
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
                    {isSelected && <div className="absolute inset-0 bg-white/[0.04] pointer-events-none" />}
                    <div className="relative z-10 h-full flex flex-col justify-between p-4">
                      <div className="flex justify-end">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shadow-lg ${isSelected ? "border-white bg-white" : "border-white/30 group-hover:border-white/60 bg-black/30 backdrop-blur-sm"}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-medium text-white tracking-tight">{v.name}</p>
                        <div className="flex items-start gap-1.5 transition-all duration-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
                          <MapPin className="w-3 h-3 text-white/50 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-white/55 leading-snug">{v.address}</p>
                        </div>
                        <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] group-hover:text-white/50 transition-colors">{v.city}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => handleInitAgenda(false)}
                disabled={isPending}
                className="px-10 py-4 rounded-2xl bg-white text-black hover:bg-gray-200 transition-all text-[10px] uppercase tracking-[0.2em] font-bold shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Initializing..." : `Initialize ${venuesList.find((v) => v.id === selectedVenueId)?.name ?? ""} Agenda`}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reset agenda action */}
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={selectedVenueId}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-gray-400 focus:outline-none focus:border-white/20 cursor-pointer"
                >
                  {venuesList.map((v) => (
                    <option key={v.id} value={v.id} className="bg-black text-white">
                      {v.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleInitAgenda(true)}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-all text-[10px] uppercase tracking-[0.1em] disabled:opacity-30"
                  title="Delete current agenda and apply selected template"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset & Apply
                </button>
              </div>
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
          onClose={() => {
            setShowCreateModal(false);
            setEditingItem(null);
          }}
          onCreate={handleCreate}
          onUpdate={editingItem ? (data) => handleUpdate(editingItem.id, data) : undefined}
          isPending={isPending}
        />
      )}
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
}

function CreateEditModal({
  item,
  eventId,
  onClose,
  onCreate,
  onUpdate,
  isPending,
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
      // Read file into memory immediately to avoid ERR_UPLOAD_FILE_CHANGED
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type });

      const formData = new FormData();
      formData.append("file", blob, file.name);
      formData.append("eventId", eventId);

      const response = await fetch("/api/admin/upload-agenda-image", {
        method: "POST",
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

