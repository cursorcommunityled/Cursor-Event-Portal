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
import { createMentor, updateMentor, deleteMentor } from "@/lib/actions/mentors";
import type { Event, DemoSignupSettings, Mentor } from "@/types";
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
  mentorId: string;
  startsAtLocal: string;
  endsAtLocal: string;
  capacity: number;
};

type MentorFormState = {
  name: string;
  title: string;
  company: string;
  bio: string;
  photoUrl: string;
  meetLink: string;
  mentorshipMode: "virtual" | "in_person" | "hybrid";
  inPersonLocation: string;
  inPersonSchedule: string;
  displayOrder: number;
  isMentor: boolean;
  isJudge: boolean;
};

interface DemosAdminClientProps {
  event: Event;
  adminCode: string;
  settings: DemoSignupSettings;
  slots: DemoSlotWithCounts[];
  mentors: Mentor[];
  embedded?: boolean;
}

export function DemosAdminClient({ event, adminCode, settings, slots, mentors: initialMentors, embedded }: DemosAdminClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "mentors">("sessions");

  // Session settings state
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const timezone = event.timezone || "America/Edmonton";
  const defaultStart = utcToLocalDateTime(settings.opens_at, timezone);
  const [isEnabled, setIsEnabled] = useState(settings.is_enabled);
  const [speakerName, setSpeakerName] = useState(settings.speaker_name || "");
  const [bannerImageUrl, setBannerImageUrl] = useState(settings.banner_image_url || "");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [opensAtLocal, setOpensAtLocal] = useState(defaultStart);
  const [closesAtLocal, setClosesAtLocal] = useState(utcToLocalDateTime(settings.closes_at, timezone));

  // Slot form state
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionFormState>({
    title: "Mentor Session",
    hostName: "",
    description: "",
    location: "",
    sessionType: "mentor",
    mentorId: "",
    startsAtLocal: defaultStart,
    endsAtLocal: addMinutes(defaultStart, 15),
    capacity: 1,
  });

  // Mentor form state
  const [editingMentorId, setEditingMentorId] = useState<string | null>(null);
  const [mentorForm, setMentorForm] = useState<MentorFormState>({
    name: "",
    title: "",
    company: "",
    bio: "",
    photoUrl: "",
    meetLink: "",
    mentorshipMode: "virtual",
    inPersonLocation: "",
    inPersonSchedule: "",
    displayOrder: 0,
    isMentor: true,
    isJudge: false,
  });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const totalBookings = slots.reduce((acc, slot) => acc + slot.signup_count, 0);
  const mentorsForSessions = initialMentors.filter((mentor) => mentor.is_mentor);

  const resetSlotForm = () => {
    setEditingSlotId(null);
    setForm({
      title: "Mentor Session",
      hostName: "",
      description: "",
      location: "",
      sessionType: "mentor",
      mentorId: "",
      startsAtLocal: defaultStart,
      endsAtLocal: addMinutes(defaultStart, 15),
      capacity: 1,
    });
  };

  const resetMentorForm = () => {
    setEditingMentorId(null);
    setMentorForm({
      name: "",
      title: "",
      company: "",
      bio: "",
      photoUrl: "",
      meetLink: "",
      mentorshipMode: "virtual",
      inPersonLocation: "",
      inPersonSchedule: "",
      displayOrder: 0,
      isMentor: true,
      isJudge: false,
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
        headers: { "x-admin-code": adminCode, "x-event-id": event.id },
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

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", event.id);
      const response = await fetch("/api/admin/upload-session-banner", {
        method: "POST",
        headers: { "x-admin-code": adminCode, "x-event-id": event.id },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error || "Failed to upload photo");
        return;
      }
      setMentorForm((prev) => ({ ...prev, photoUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
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
      resetSlotForm();
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
      mentorId: slot.mentor_id || "",
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
      if (editingSlotId === slot.id) resetSlotForm();
      router.refresh();
    });
  };

  const handleSubmitMentor = () => {
    setError(null);
    startTransition(async () => {
      const action = editingMentorId
        ? updateMentor(event.id, event.slug, adminCode, editingMentorId, mentorForm)
        : createMentor(event.id, event.slug, adminCode, mentorForm);
      const result = await action;
      if (!result.success) {
        setError(result.error || "Failed to save mentor");
        return;
      }
      resetMentorForm();
      router.refresh();
    });
  };

  const handleEditMentor = (mentor: Mentor) => {
    setEditingMentorId(mentor.id);
    setMentorForm({
      name: mentor.name,
      title: mentor.title || "",
      company: mentor.company || "",
      bio: mentor.bio || "",
      photoUrl: mentor.photo_url || "",
      meetLink: mentor.meet_link || "",
      mentorshipMode: mentor.mentorship_mode || "virtual",
      inPersonLocation: mentor.in_person_location || "",
      inPersonSchedule: mentor.in_person_schedule || "",
      displayOrder: mentor.display_order,
      isMentor: mentor.is_mentor,
      isJudge: mentor.is_judge,
    });
  };

  const handleDeleteMentor = (mentor: Mentor) => {
    const assignedCount = slots.filter((s) => s.mentor_id === mentor.id).length;
    const msg = assignedCount > 0
      ? `Delete ${mentor.name}? This will unlink ${assignedCount} session(s) from this mentor.`
      : `Delete ${mentor.name}?`;
    if (!confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMentor(event.id, event.slug, adminCode, mentor.id);
      if (!result.success) {
        setError(result.error || "Failed to delete mentor");
        return;
      }
      if (editingMentorId === mentor.id) resetMentorForm();
      router.refresh();
    });
  };

  const handleMentorSelect = (mentorId: string) => {
    const mentor = mentorsForSessions.find((m) => m.id === mentorId);
    setForm((prev) => ({
      ...prev,
      mentorId,
      hostName: mentor ? mentor.name : prev.hostName,
    }));
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20";
  const getMentorModeLabel = (mode: Mentor["mentorship_mode"]) => {
    if (mode === "in_person") return "In-person";
    if (mode === "hybrid") return "Hybrid";
    return "Virtual";
  };

  const sessionsContent = (
    <>
      {/* Session Settings */}
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-light tracking-tight">Session Settings</h2>
            <p className="text-xs text-gray-500 mt-1">Controls attendee access to session booking.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="h-4 w-4" />
            Enabled
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Default Host Label</label>
            <input type="text" value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} placeholder="Optional fallback host" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Booking Opens</label>
            <input type="datetime-local" value={opensAtLocal} onChange={(e) => setOpensAtLocal(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Booking Closes</label>
            <input type="datetime-local" value={closesAtLocal} onChange={(e) => setClosesAtLocal(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Session Banner</span>
            <input type="text" value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} placeholder="Leave blank to hide the banner" className={inputClass} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" className="hidden" onChange={(e) => handleBannerUpload(e.target.files?.[0])} />
            <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading || isPending} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-white/20 disabled:opacity-40">
              {bannerUploading ? "Uploading..." : "Upload Banner"}
            </button>
            {bannerImageUrl && (
              <button type="button" onClick={() => setBannerImageUrl("")} disabled={bannerUploading || isPending} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white disabled:opacity-40">
                Clear Banner
              </button>
            )}
            <p className="text-xs text-gray-600">Upload fills the URL; click Save Settings to publish it.</p>
          </div>
          {bannerImageUrl && (
            <div className="h-24 rounded-2xl border border-white/10 bg-white/[0.02] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(bannerImageUrl)})` }} />
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button onClick={handleSaveSettings} disabled={isPending} className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
          {isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Create / Edit Session */}
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div>
          <h3 className="text-xl font-light tracking-tight">{editingSlotId ? "Edit Session" : "Create Session"}</h3>
          <p className="text-sm text-gray-500 mt-1">Create mentor or student availability for builders to book.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Mentor</span>
            <select
              value={form.mentorId}
              onChange={(e) => handleMentorSelect(e.target.value)}
              className={inputClass}
            >
              <option value="">No mentor assigned</option>
              {mentorsForSessions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.title ? ` — ${m.title}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Host</span>
            <input value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} placeholder="Mentor or student name" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Location</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Table, room, booth..." className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Starts</span>
            <input type="datetime-local" value={form.startsAtLocal} onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value })} className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Ends</span>
            <input type="datetime-local" value={form.endsAtLocal} onChange={(e) => setForm({ ...form, endsAtLocal: e.target.value })} className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Capacity</span>
            <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className={inputClass} />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What can builders get help with?" className={`${inputClass} resize-none`} />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSubmitSlot} disabled={isPending} className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
            {editingSlotId ? "Update Session" : "Create Session"}
          </button>
          {editingSlotId && (
            <button onClick={resetSlotForm} className="h-12 px-6 rounded-2xl border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Session Occupancy */}
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
                    {slot.mentor ? <span className="text-gray-600"> · {slot.mentor.name}</span> : ""}
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
    </>
  );

  const mentorsContent = (
    <>
      {/* Create / Edit Mentor */}
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div>
          <h3 className="text-xl font-light tracking-tight">{editingMentorId ? "Edit Mentor" : "Add Mentor"}</h3>
          <p className="text-sm text-gray-500 mt-1">Virtual mentors use booking slots; in-person mentors can show when and where attendees should find them.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Name *</span>
            <input value={mentorForm.name} onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })} placeholder="Full name" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Title</span>
            <input value={mentorForm.title} onChange={(e) => setMentorForm({ ...mentorForm, title: e.target.value })} placeholder="e.g. Senior Engineer" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Company</span>
            <input value={mentorForm.company} onChange={(e) => setMentorForm({ ...mentorForm, company: e.target.value })} placeholder="Company or org" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Mentorship Type</span>
            <select value={mentorForm.mentorshipMode} onChange={(e) => setMentorForm({ ...mentorForm, mentorshipMode: e.target.value as MentorFormState["mentorshipMode"] })} className={inputClass}>
              <option value="virtual">Virtual booking</option>
              <option value="in_person">In-person only</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Google Meet Link</span>
            <input value={mentorForm.meetLink} onChange={(e) => setMentorForm({ ...mentorForm, meetLink: e.target.value })} placeholder="Used after a virtual booking" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Display Order</span>
            <input type="number" min={0} value={mentorForm.displayOrder} onChange={(e) => setMentorForm({ ...mentorForm, displayOrder: Number(e.target.value) })} className={inputClass} />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">In-Person Location</span>
            <input value={mentorForm.inPersonLocation} onChange={(e) => setMentorForm({ ...mentorForm, inPersonLocation: e.target.value })} placeholder="Table, room, booth, or roaming area" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">In-Person Schedule</span>
            <input value={mentorForm.inPersonSchedule} onChange={(e) => setMentorForm({ ...mentorForm, inPersonSchedule: e.target.value })} placeholder="e.g. 1-3 PM at table 4, 4 PM rounds" className={inputClass} />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Bio</span>
          <textarea value={mentorForm.bio} onChange={(e) => setMentorForm({ ...mentorForm, bio: e.target.value })} rows={3} placeholder="Short bio shown to attendees" className={`${inputClass} resize-none`} />
        </label>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Photo URL</span>
            <input type="text" value={mentorForm.photoUrl} onChange={(e) => setMentorForm({ ...mentorForm, photoUrl: e.target.value })} placeholder="https://... or upload below" className={inputClass} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files?.[0])} />
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading || isPending} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-white/20 disabled:opacity-40">
              {photoUploading ? "Uploading..." : "Upload Photo"}
            </button>
            {mentorForm.photoUrl && (
              <button type="button" onClick={() => setMentorForm({ ...mentorForm, photoUrl: "" })} disabled={photoUploading || isPending} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white disabled:opacity-40">
                Clear
              </button>
            )}
          </div>
          {mentorForm.photoUrl && (
            <img src={mentorForm.photoUrl} alt="Preview" className="h-20 w-20 rounded-2xl object-cover border border-white/10" />
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSubmitMentor} disabled={isPending} className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
            {editingMentorId ? "Update Mentor" : "Add Mentor"}
          </button>
          {editingMentorId && (
            <button onClick={resetMentorForm} className="h-12 px-6 rounded-2xl border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Mentor list */}
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div>
          <h3 className="text-xl font-light tracking-tight">Mentors</h3>
          <p className="text-sm text-gray-500 mt-1">{mentorsForSessions.length} mentor{mentorsForSessions.length !== 1 ? "s" : ""} added</p>
        </div>

        <div className="space-y-3">
          {mentorsForSessions.length === 0 && <p className="text-sm text-gray-600">No mentors added yet.</p>}
          {mentorsForSessions.map((mentor) => {
            const slotCount = slots.filter((s) => s.mentor_id === mentor.id).length;
            return (
              <div key={mentor.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start gap-4">
                  {mentor.photo_url ? (
                    <img src={mentor.photo_url} alt={mentor.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-lg text-white flex-shrink-0">
                      {mentor.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{mentor.name}</p>
                    {mentor.title && <p className="text-xs text-gray-400 mt-0.5">{mentor.title}{mentor.company ? ` · ${mentor.company}` : ""}</p>}
                    <p className="text-xs text-gray-600 mt-1">
                      {getMentorModeLabel(mentor.mentorship_mode)} · {slotCount} slot{slotCount !== 1 ? "s" : ""} assigned{mentor.meet_link ? " · Meet link set" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEditMentor(mentor)} className="text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-white">Edit</button>
                    <button onClick={() => handleDeleteMentor(mentor)} className="text-[10px] uppercase tracking-[0.15em] text-red-400/80 hover:text-red-300">Delete</button>
                  </div>
                </div>
                {mentor.bio && <p className="text-xs text-gray-500 mt-3 line-clamp-2">{mentor.bio}</p>}
                {(mentor.in_person_schedule || mentor.in_person_location) && (
                  <p className="text-xs text-gray-500 mt-3">
                    {mentor.in_person_schedule}
                    {mentor.in_person_schedule && mentor.in_person_location ? " · " : ""}
                    {mentor.in_person_location}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  const content = (
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex gap-2">
        {(["sessions", "mentors"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError(null); }}
            className={`h-10 px-5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
              activeTab === tab
                ? "bg-white text-black shadow-glow scale-105"
                : "bg-white/5 text-gray-500 hover:text-gray-300 border border-white/10"
            }`}
          >
            {tab === "sessions" ? "Sessions" : "Mentors"}
            {tab === "mentors" && mentorsForSessions.length > 0 && (
              <span className="ml-2 text-[9px] opacity-60">{mentorsForSessions.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "sessions" ? sessionsContent : mentorsContent}
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
