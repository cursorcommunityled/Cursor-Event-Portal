"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { formatTime } from "@/lib/utils";
import {
  createSessionSlot,
  deleteSessionSlot,
  updateDemoSignupSettings,
  updateSessionSlot,
} from "@/lib/actions/demo";
import type { Event, DemoSignupSettings } from "@/types";
import type { DemoSlotWithCounts } from "@/lib/demo/service";

function utcToLocalDateTime(utcValue: string, timezone: string): string {
  const date = new Date(utcValue);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function addMinutes(localValue: string, minutes: number) {
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return localValue;
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString().slice(0, 16);
}

type SessionFormState = {
  title: string;
  hostName: string;
  description: string;
  location: string;
  sessionType: string;
  startsAtLocal: string;
  endsAtLocal: string;
  capacity: number;
};

interface DemosAdminClientProps {
  event: Event;
  adminCode: string;
  settings: DemoSignupSettings;
  slots: DemoSlotWithCounts[];
  embedded?: boolean;
}

export function DemosAdminClient({ event, adminCode, settings, slots, embedded }: DemosAdminClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const timezone = event.timezone || "America/Edmonton";
  const defaultStart = utcToLocalDateTime(settings.opens_at, timezone);
  const [isEnabled, setIsEnabled] = useState(settings.is_enabled);
  const [speakerName, setSpeakerName] = useState(settings.speaker_name || "");
  const [bannerImageUrl, setBannerImageUrl] = useState(settings.banner_image_url || "");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [opensAtLocal, setOpensAtLocal] = useState(defaultStart);
  const [closesAtLocal, setClosesAtLocal] = useState(utcToLocalDateTime(settings.closes_at, timezone));
  const [form, setForm] = useState<SessionFormState>({
    title: "Mentor Session",
    hostName: "",
    description: "",
    location: "",
    sessionType: "mentor",
    startsAtLocal: defaultStart,
    endsAtLocal: addMinutes(defaultStart, 15),
    capacity: 1,
  });

  const totalBookings = slots.reduce((acc, slot) => acc + slot.signup_count, 0);

  const resetForm = () => {
    setEditingSlotId(null);
    setForm({
      title: "Mentor Session",
      hostName: "",
      description: "",
      location: "",
      sessionType: "mentor",
      startsAtLocal: defaultStart,
      endsAtLocal: addMinutes(defaultStart, 15),
      capacity: 1,
    });
  };

  const handleBannerUpload = async (file: File | undefined) => {
    if (!file) return;

    setError(null);
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", event.id);

      const response = await fetch("/api/admin/upload-session-banner", {
        method: "POST",
        headers: {
          "x-admin-code": adminCode,
          "x-event-id": event.id,
        },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        setError(data.error || "Failed to upload session banner");
        return;
      }

      setBannerImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload session banner");
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleSaveSettings = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDemoSignupSettings(event.id, event.slug, adminCode, {
        isEnabled,
        speakerName,
        bannerImageUrl,
        opensAtLocal,
        closesAtLocal,
        timezone,
      });

      if (!result.success) {
        setError(result.error || "Failed to save session settings");
        return;
      }

      router.refresh();
    });
  };

  const handleSubmitSlot = () => {
    setError(null);
    startTransition(async () => {
      const action = editingSlotId
        ? updateSessionSlot(event.id, event.slug, adminCode, editingSlotId, { ...form, timezone })
        : createSessionSlot(event.id, event.slug, adminCode, { ...form, timezone });
      const result = await action;

      if (!result.success) {
        setError(result.error || "Failed to save session");
        return;
      }

      resetForm();
      router.refresh();
    });
  };

  const handleEditSlot = (slot: DemoSlotWithCounts) => {
    setEditingSlotId(slot.id);
    setForm({
      title: slot.title || "Mentor Session",
      hostName: slot.host_name || "",
      description: slot.description || "",
      location: slot.location || "",
      sessionType: slot.session_type || "mentor",
      startsAtLocal: utcToLocalDateTime(slot.starts_at, timezone),
      endsAtLocal: utcToLocalDateTime(slot.ends_at, timezone),
      capacity: slot.capacity,
    });
  };

  const handleDeleteSlot = (slot: DemoSlotWithCounts) => {
    if (!confirm(`Delete ${slot.title || "this session"}? Existing bookings will be removed.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSessionSlot(event.id, event.slug, adminCode, slot.id);
      if (!result.success) {
        setError(result.error || "Failed to delete session");
        return;
      }
      if (editingSlotId === slot.id) resetForm();
      router.refresh();
    });
  };

  const content = (
    <div className="space-y-8">
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-light tracking-tight">Session Settings</h2>
            <p className="text-xs text-gray-500 mt-1">Controls attendee access to session booking.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Enabled
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Default Host Label</label>
            <input
              type="text"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              placeholder="Optional fallback host"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Booking Opens</label>
            <input
              type="datetime-local"
              value={opensAtLocal}
              onChange={(e) => setOpensAtLocal(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Booking Closes</label>
            <input
              type="datetime-local"
              value={closesAtLocal}
              onChange={(e) => setClosesAtLocal(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Session Banner</span>
            <input
              type="text"
              value={bannerImageUrl}
              onChange={(e) => setBannerImageUrl(e.target.value)}
              placeholder="Leave blank to hide the banner"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleBannerUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={bannerUploading || isPending}
              className="h-10 px-4 rounded-2xl border border-white/10 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-white/20 disabled:opacity-40"
            >
              {bannerUploading ? "Uploading..." : "Upload Banner"}
            </button>
            {bannerImageUrl && (
              <button
                type="button"
                onClick={() => setBannerImageUrl("")}
                disabled={bannerUploading || isPending}
                className="h-10 px-4 rounded-2xl border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white disabled:opacity-40"
              >
                Clear Banner
              </button>
            )}
            <p className="text-xs text-gray-600">Upload fills the URL; click Save Settings to publish it.</p>
          </div>
          {bannerImageUrl && (
            <div
              className="h-24 rounded-2xl border border-white/10 bg-white/[0.02] bg-cover bg-center"
              style={{ backgroundImage: `url(${JSON.stringify(bannerImageUrl)})` }}
            />
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleSaveSettings}
          disabled={isPending}
          className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40"
        >
          {isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div>
          <h3 className="text-xl font-light tracking-tight">{editingSlotId ? "Edit Session" : "Create Session"}</h3>
          <p className="text-sm text-gray-500 mt-1">Create mentor or student availability for builders to book.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20" />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Host</span>
            <input value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} placeholder="Mentor or student name" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20" />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Starts</span>
            <input type="datetime-local" value={form.startsAtLocal} onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20" />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Ends</span>
            <input type="datetime-local" value={form.endsAtLocal} onChange={(e) => setForm({ ...form, endsAtLocal: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20" />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Capacity</span>
            <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/20" />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Location</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Table, room, booth..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20" />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What can builders get help with?" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 resize-none" />
        </label>

        <div className="flex gap-3">
          <button onClick={handleSubmitSlot} disabled={isPending} className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
            {editingSlotId ? "Update Session" : "Create Session"}
          </button>
          {editingSlotId && (
            <button onClick={resetForm} className="h-12 px-6 rounded-2xl border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-[32px] p-8 border-white/10 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-light tracking-tight">Session Occupancy</h3>
            <p className="text-sm text-gray-500 mt-1">{slots.length} sessions · {totalBookings} total bookings</p>
          </div>
        </div>

        <div className="space-y-3">
          {slots.length === 0 && <p className="text-sm text-gray-600">No sessions created yet.</p>}
          {slots.map((slot) => (
            <div key={slot.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white">{slot.title || "Mentor Session"}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {slot.host_name || speakerName || "Host TBD"} · {formatTime(slot.starts_at, timezone)} - {formatTime(slot.ends_at, timezone)}
                    {slot.location ? ` · ${slot.location}` : ""}
                  </p>
                  {slot.description && <p className="text-xs text-gray-400 mt-2">{slot.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{slot.signup_count}/{slot.capacity} booked</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleEditSlot(slot)} className="text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-white">Edit</button>
                    <button onClick={() => handleDeleteSlot(slot)} className="text-[10px] uppercase tracking-[0.15em] text-red-400/80 hover:text-red-300">Delete</button>
                  </div>
                </div>
              </div>
              {slot.attendees.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {slot.attendees.map((attendee) => (
                    <span key={attendee.id} className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-300 border border-white/10">
                      {attendee.name} {attendee.email ? `(${attendee.email})` : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-600">No attendees booked.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col">
      <AdminHeader adminCode={adminCode} subtitle="Session Booking" />
      <main className="max-w-4xl mx-auto px-6 py-8 pb-16 w-full flex-1">
        {content}
      </main>
    </div>
  );
}
