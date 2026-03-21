"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Check } from "lucide-react";
import { ActiveVenueSelector } from "@/components/admin/ActiveVenueSelector";
import { updateEventDetails } from "@/lib/actions/agenda";
import { updateVenue } from "@/lib/actions/event-dashboard";
import type { Event, Venue } from "@/types";

type EventOption = {
  id: string;
  slug: string;
  name: string;
  venue: string | null;
  start_time: string | null;
  status: string;
  themeTitle?: string | null;
};

interface VenueAdminTabProps {
  event: Event;
  eventSlug: string;
  venues: Venue[];
  allEvents: EventOption[];
  activeSlug: string;
}

export function VenueAdminTab({
  event,
  eventSlug,
  venues,
  allEvents,
  activeSlug,
}: VenueAdminTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Pre-select the venue that matches the current event
  const matchingVenue = venues.find((v) => v.name === event.venue);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    matchingVenue?.id ?? venues[0]?.id ?? ""
  );
  const [eventVenue, setEventVenue] = useState(event.venue || "");
  const [eventAddress, setEventAddress] = useState(event.address || "");
  const [venueImageUrl, setVenueImageUrl] = useState(event.venue_image_url || "");

  const handleVenueSelect = (v: Venue) => {
    setSelectedVenueId(v.id);
    setEventVenue(v.name);
    setEventAddress(v.address || "");
    setVenueImageUrl(v.image_url || "");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch("/api/admin/upload-venue-image", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (data.success && data.url) {
        const newUrl = data.url as string;
        setVenueImageUrl(newUrl);
        if (selectedVenueId) {
          await updateVenue(selectedVenueId, { image_url: newUrl });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateEventDetails(event.id, eventSlug, {
        name: event.name,
        venue: eventVenue.trim() || null,
        address: eventAddress.trim() || null,
        start_time: event.start_time,
        end_time: event.end_time,
        venue_image_url: venueImageUrl.trim() || null,
        capacity: event.capacity,
      });
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } else {
        setError(result.error || "Failed to save venue");
      }
    });
  };

  return (
    <div className="space-y-12">
      {/* ── Active Event Selector ── */}
      <ActiveVenueSelector events={allEvents} activeSlug={activeSlug} />

      {/* ── Venue for This Event ── */}
      <div className="space-y-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-medium mb-1">
            Venue for This Event
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Select a venue to apply its name, address, and preview image to the attendee portal header.
          </p>
        </div>

        {error && (
          <div className="glass rounded-2xl p-4 bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Venue cards */}
        <div className="grid grid-cols-2 gap-4">
          {venues.map((v) => {
            const isSelected = selectedVenueId === v.id;
            return (
              <div
                key={v.id}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 h-44 ${
                  isSelected
                    ? "ring-2 ring-white/60 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
                    : "ring-1 ring-white/[0.06] hover:ring-white/20"
                }`}
                onClick={() => handleVenueSelect(v)}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
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
                    <p className="text-base font-medium text-white tracking-tight leading-tight">
                      {v.name}
                    </p>
                    <div className="flex items-start gap-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                      <MapPin className="w-3 h-3 text-white/50 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-white/55 leading-snug">{v.address}</p>
                    </div>
                    <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] group-hover:text-white/50 transition-colors">
                      {v.city}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
              Venue Name
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

        {/* Venue image */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium mb-2">
            Venue Image
          </label>
          <div className="space-y-3">
            {venueImageUrl && (
              <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-white/10">
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
                onChange={handleImageUpload}
                disabled={uploadingImage || isPending}
                className="hidden"
              />
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white hover:bg-white/10 transition-all cursor-pointer text-center text-sm">
                {uploadingImage ? "Uploading..." : venueImageUrl ? "Change Image" : "Upload Image"}
              </div>
            </label>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="h-12 px-8 rounded-full bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl flex items-center gap-2"
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Saved
            </>
          ) : isPending ? (
            "..."
          ) : (
            "Save Venue"
          )}
        </button>
      </div>
    </div>
  );
}
