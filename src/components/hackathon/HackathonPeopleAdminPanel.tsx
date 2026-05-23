"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionSlot, deleteSessionSlot, updateSessionSlot } from "@/lib/actions/demo";
import { createMentor, updateMentor, deleteMentor } from "@/lib/actions/mentors";
import { formatTime } from "@/lib/utils";
import type { Event, Mentor } from "@/types";
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

type PersonFormState = {
  name: string;
  title: string;
  company: string;
  bio: string;
  photoUrl: string;
  meetLink: string;
  virtualCallInstructions: string;
  mentorshipMode: "virtual" | "in_person" | "hybrid";
  inPersonLocation: string;
  inPersonSchedule: string;
  displayOrder: number;
  isMentor: boolean;
  isJudge: boolean;
};

type AvailabilityFormState = {
  startsAtLocal: string;
  endsAtLocal: string;
  capacity: number;
  description: string;
};

type RolePreset = "mentor" | "judge" | "both";

const emptyForm = (): PersonFormState => ({
  name: "",
  title: "",
  company: "",
  bio: "",
  photoUrl: "",
  meetLink: "",
  virtualCallInstructions: "",
  mentorshipMode: "virtual",
  inPersonLocation: "",
  inPersonSchedule: "",
  displayOrder: 0,
  isMentor: true,
  isJudge: false,
});

interface Props {
  event: Event;
  adminCode: string;
  initialPeople: Mentor[];
  initialSlots: DemoSlotWithCounts[];
}

export function HackathonPeopleAdminPanel({ event, adminCode, initialPeople, initialSlots }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonFormState>(emptyForm());
  const timezone = event.timezone || "America/Edmonton";
  const defaultAvailabilityStart = utcToLocalDateTime(event.start_time || new Date().toISOString(), timezone);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityFormState>({
    startsAtLocal: defaultAvailabilityStart,
    endsAtLocal: addMinutes(defaultAvailabilityStart, 15),
    capacity: 1,
    description: "",
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [filterTab, setFilterTab] = useState<"all" | "mentors" | "judges">("all");

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60";

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setEditingSlotId(null);
    setAvailabilityForm({
      startsAtLocal: defaultAvailabilityStart,
      endsAtLocal: addMinutes(defaultAvailabilityStart, 15),
      capacity: 1,
      description: "",
    });
  };

  const rolePreset: RolePreset = form.isMentor && form.isJudge
    ? "both"
    : form.isJudge
      ? "judge"
      : "mentor";

  const setRolePreset = (preset: RolePreset) => {
    setForm((prev) => ({
      ...prev,
      isMentor: preset === "mentor" || preset === "both",
      isJudge: preset === "judge" || preset === "both",
    }));
  };

  const handleEdit = (person: Mentor) => {
    setEditingId(person.id);
    setEditingSlotId(null);
    setError(null);
    setForm({
      name: person.name,
      title: person.title || "",
      company: person.company || "",
      bio: person.bio || "",
      photoUrl: person.photo_url || "",
      meetLink: person.meet_link || "",
      virtualCallInstructions: person.virtual_call_instructions || "",
      mentorshipMode: person.mentorship_mode,
      inPersonLocation: person.in_person_location || "",
      inPersonSchedule: person.in_person_schedule || "",
      displayOrder: person.display_order,
      isMentor: person.is_mentor,
      isJudge: person.is_judge,
    });
    setAvailabilityForm((prev) => ({
      ...prev,
      description: "",
    }));
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleDelete = (person: Mentor) => {
    if (!confirm(`Delete ${person.name}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMentor(event.id, event.slug, adminCode, person.id);
      if (!result.success) { setError(result.error || "Failed to delete"); return; }
      if (editingId === person.id) resetForm();
      router.refresh();
    });
  };

  const selectedPerson = editingId ? initialPeople.find((person) => person.id === editingId) ?? null : null;
  const selectedPersonSlots = editingId
    ? initialSlots.filter((slot) => slot.mentor_id === editingId)
    : [];
  const selectedEditingSlot = editingSlotId
    ? initialSlots.find((slot) => slot.id === editingSlotId) ?? null
    : null;
  const editingSlotHasBookings = (selectedEditingSlot?.signup_count ?? 0) > 0;
  const minAvailabilityCapacity = Math.max(1, selectedEditingSlot?.signup_count ?? 0);
  const showAvailabilityEditor = Boolean(
    editingId &&
    form.isMentor &&
    form.mentorshipMode !== "in_person"
  );

  const resetAvailabilityForm = () => {
    setEditingSlotId(null);
    setAvailabilityForm({
      startsAtLocal: defaultAvailabilityStart,
      endsAtLocal: addMinutes(defaultAvailabilityStart, 15),
      capacity: 1,
      description: "",
    });
  };

  const handleEditSlot = (slot: DemoSlotWithCounts) => {
    setEditingSlotId(slot.id);
    setAvailabilityForm({
      startsAtLocal: utcToLocalDateTime(slot.starts_at, timezone),
      endsAtLocal: utcToLocalDateTime(slot.ends_at, timezone),
      capacity: slot.capacity,
      description: slot.description || "",
    });
  };

  const handleSubmitAvailability = () => {
    if (!editingId || !selectedPerson) return;
    setError(null);
    startTransition(async () => {
      const payload = {
        title: "Mentor Session",
        hostName: form.name.trim() || selectedPerson.name,
        description: availabilityForm.description,
        location: form.meetLink.trim() ? "Online" : "",
        sessionType: "mentor",
        mentorId: editingId,
        startsAtLocal: availabilityForm.startsAtLocal,
        endsAtLocal: availabilityForm.endsAtLocal,
        capacity: availabilityForm.capacity,
        timezone,
      };
      const result = editingSlotId
        ? await updateSessionSlot(event.id, event.slug, adminCode, editingSlotId, payload)
        : await createSessionSlot(event.id, event.slug, adminCode, payload);
      if (!result.success) { setError(result.error || "Failed to save availability"); return; }
      resetAvailabilityForm();
      router.refresh();
    });
  };

  const handleDeleteSlot = (slot: DemoSlotWithCounts) => {
    if (!confirm(`Delete ${formatTime(slot.starts_at, timezone)} availability for ${selectedPerson?.name || "this mentor"}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSessionSlot(event.id, event.slug, adminCode, slot.id);
      if (!result.success) { setError(result.error || "Failed to delete availability"); return; }
      if (editingSlotId === slot.id) resetAvailabilityForm();
      router.refresh();
    });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const action = editingId
        ? updateMentor(event.id, event.slug, adminCode, editingId, form)
        : createMentor(event.id, event.slug, adminCode, form);
      const result = await action;
      if (!result.success) { setError(result.error || "Failed to save"); return; }
      resetForm();
      router.refresh();
    });
  };

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", event.id);
      const res = await fetch("/api/admin/upload-session-banner", {
        method: "POST",
        headers: { "x-admin-code": adminCode, "x-event-id": event.id },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error || "Upload failed"); return; }
      setForm((prev) => ({ ...prev, photoUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const getPersonSlots = (personId: string) => initialSlots.filter((slot) => slot.mentor_id === personId);
  const isBookablePerson = (person: Mentor, slots = getPersonSlots(person.id)) =>
    person.mentorship_mode !== "in_person" && (person.is_mentor || slots.length > 0);

  const visiblePeople = initialPeople
    .filter((p) => {
      if (filterTab === "mentors") return p.is_mentor;
      if (filterTab === "judges") return p.is_judge;
      return true;
    })
    .sort((a, b) => {
      const aSlots = getPersonSlots(a.id);
      const bSlots = getPersonSlots(b.id);
      const aBookable = isBookablePerson(a, aSlots);
      const bBookable = isBookablePerson(b, bSlots);
      if (aBookable !== bBookable) return aBookable ? -1 : 1;

      const aBooked = aSlots.reduce((total, slot) => total + slot.signup_count, 0);
      const bBooked = bSlots.reduce((total, slot) => total + slot.signup_count, 0);
      if (aBookable && aBooked !== bBooked) return bBooked - aBooked;

      return (a.display_order - b.display_order) || a.name.localeCompare(b.name);
    });

  const mentorCount = initialPeople.filter((p) => p.is_mentor).length;
  const judgeCount = initialPeople.filter((p) => p.is_judge).length;

  return (
    <div className="space-y-6">
      {/* Form */}
      <div ref={formRef} className="glass rounded-[32px] p-8 border-white/10 space-y-5 scroll-mt-6">
        <div>
          <h3 className="text-xl font-light tracking-tight">
            {editingId ? "Edit Person" : "Add Person"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Add mentors and judges for the hackathon. Select both roles when someone should appear on both pages.
          </p>
        </div>

        {/* Role selector */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3">
            {([
              { id: "mentor", label: "Mentor" },
              { id: "judge", label: "Judge" },
              { id: "both", label: "Both" },
            ] as const).map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setRolePreset(role.id)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
                  rolePreset === role.id
                    ? role.id === "judge"
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-400"
                      : "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/5 text-gray-500 hover:text-gray-300"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          {!form.isMentor && (
            <p className="text-xs text-gray-600">
              Judge-only people appear on the judges page. Mentorship fields are hidden.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Name *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Engineer" className={inputClass} />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Company</span>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company or org" className={inputClass} />
          </label>
          {form.isMentor && (
            <label className="space-y-2">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Mentorship Type</span>
              <select value={form.mentorshipMode} onChange={(e) => setForm({ ...form, mentorshipMode: e.target.value as PersonFormState["mentorshipMode"] })} className={inputClass}>
                <option value="virtual">Virtual (bookable)</option>
                <option value="in_person">In-person only</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
          )}
          {form.isMentor && form.mentorshipMode !== "in_person" && (
            <label className="space-y-2">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Google Meet Link</span>
              <input value={form.meetLink} onChange={(e) => setForm({ ...form, meetLink: e.target.value })} placeholder="Shared after booking" className={inputClass} />
            </label>
          )}
          <label className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Display Order</span>
            <input type="number" min={0} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} className={inputClass} />
          </label>
        </div>

        {form.isMentor && form.mentorshipMode !== "in_person" && (
          <label className="space-y-2 block">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Call Instructions</span>
            <textarea
              value={form.virtualCallInstructions}
              onChange={(e) => setForm({ ...form, virtualCallInstructions: e.target.value })}
              rows={3}
              placeholder="Optional: what attendees see with the Meet URL after their booking unlocks"
              className={`${inputClass} resize-none`}
            />
          </label>
        )}

        {form.isMentor && (form.mentorshipMode === "in_person" || form.mentorshipMode === "hybrid") && (
          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">In-Person Location</span>
              <input value={form.inPersonLocation} onChange={(e) => setForm({ ...form, inPersonLocation: e.target.value })} placeholder="Table, room, or area" className={inputClass} />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">In-Person Schedule</span>
              <input value={form.inPersonSchedule} onChange={(e) => setForm({ ...form, inPersonSchedule: e.target.value })} placeholder="e.g. 1–3 PM at table 4" className={inputClass} />
            </label>
          </div>
        )}

        <label className="space-y-2 block">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Bio</span>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Short bio shown to attendees" className={`${inputClass} resize-none`} />
        </label>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Photo URL</span>
            <input type="text" value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://... or upload below" className={inputClass} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files?.[0])} />
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading || isPending} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-white/20 disabled:opacity-40">
              {photoUploading ? "Uploading..." : "Upload Photo"}
            </button>
            {form.photoUrl && (
              <button type="button" onClick={() => setForm({ ...form, photoUrl: "" })} disabled={photoUploading || isPending} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white disabled:opacity-40">
                Clear
              </button>
            )}
          </div>
          {form.photoUrl && (
            <img src={form.photoUrl} alt="Preview" className="h-20 w-20 rounded-2xl object-cover border border-white/10" />
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={isPending || !form.name.trim() || (!form.isMentor && !form.isJudge)} className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
            {editingId ? "Update Person" : "Add Person"}
          </button>
          {editingId && (
            <button onClick={resetForm} className="h-12 px-6 rounded-2xl border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white">
              Cancel
            </button>
          )}
        </div>

        {showAvailabilityEditor && (
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 space-y-5">
            <div>
              <h4 className="text-sm font-medium text-white">Bookable Availability</h4>
              <p className="text-xs text-gray-500 mt-1">
                These slots are what attendees can book for {form.name || selectedPerson?.name || "this mentor"}.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="space-y-2">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Starts</span>
                <input type="datetime-local" value={availabilityForm.startsAtLocal} onChange={(e) => setAvailabilityForm({ ...availabilityForm, startsAtLocal: e.target.value })} disabled={editingSlotHasBookings} className={inputClass} />
              </label>
              <label className="space-y-2">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Ends</span>
                <input type="datetime-local" value={availabilityForm.endsAtLocal} onChange={(e) => setAvailabilityForm({ ...availabilityForm, endsAtLocal: e.target.value })} disabled={editingSlotHasBookings} className={inputClass} />
              </label>
              <label className="space-y-2">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Capacity</span>
                <input type="number" min={minAvailabilityCapacity} value={availabilityForm.capacity} onChange={(e) => setAvailabilityForm({ ...availabilityForm, capacity: Number(e.target.value) })} className={inputClass} />
              </label>
            </div>

            {editingSlotHasBookings && (
              <p className="text-xs text-amber-300/80">
                This slot already has a booking, so its time is locked. Capacity and notes can still be updated.
              </p>
            )}

            <label className="space-y-2 block">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Slot Notes</span>
              <textarea value={availabilityForm.description} onChange={(e) => setAvailabilityForm({ ...availabilityForm, description: e.target.value })} rows={2} placeholder="Optional: what builders can ask about" className={`${inputClass} resize-none`} />
            </label>

            <div className="flex gap-3">
              <button onClick={handleSubmitAvailability} disabled={isPending || !availabilityForm.startsAtLocal || !availabilityForm.endsAtLocal} className="h-10 px-4 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
                {editingSlotId ? "Update Slot" : "Add Slot"}
              </button>
              {editingSlotId && (
                <button onClick={resetAvailabilityForm} className="h-10 px-4 rounded-2xl border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white">
                  Cancel Slot Edit
                </button>
              )}
            </div>

            <div className="space-y-2">
              {selectedPersonSlots.length === 0 && (
                <p className="text-xs text-gray-600">No availability slots yet.</p>
              )}
              {selectedPersonSlots.map((slot) => (
                <div key={slot.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <div>
                    <p className="text-xs text-gray-300">
                      {formatTime(slot.starts_at, timezone)} - {formatTime(slot.ends_at, timezone)}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {slot.signup_count}/{slot.capacity} booked{slot.description ? ` · ${slot.description}` : ""}
                    </p>
                    {slot.attendees.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {slot.attendees.map((attendee) => (
                          <p key={attendee.id} className="text-[11px] text-gray-400">
                            {attendee.name}{attendee.email ? ` (${attendee.email})` : ""}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-700 mt-2">No attendee booked yet.</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEditSlot(slot)} className="text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-white">Edit Slot</button>
                    <button onClick={() => handleDeleteSlot(slot)} className="text-[10px] uppercase tracking-[0.15em] text-red-400/80 hover:text-red-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-light tracking-tight">People</h3>
            <p className="text-sm text-gray-500 mt-1">
              {mentorCount} mentor{mentorCount !== 1 ? "s" : ""} · {judgeCount} judge{judgeCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
            {(["all", "mentors", "judges"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 rounded-xl text-[10px] uppercase tracking-[0.15em] transition-all ${filterTab === tab ? "bg-white text-black" : "text-gray-500 hover:text-gray-300"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {visiblePeople.length === 0 && (
            <p className="text-sm text-gray-600">None added yet.</p>
          )}
          {visiblePeople.map((person) => {
            const personSlots = getPersonSlots(person.id);
            const isBookableMentor = isBookablePerson(person, personSlots);
            const bookedCount = personSlots.reduce((total, slot) => total + slot.signup_count, 0);
            const capacityCount = personSlots.reduce((total, slot) => total + slot.capacity, 0);
            const bookingRoleLabel = person.is_judge && person.is_mentor
              ? "Virtual judge + mentor"
              : person.is_judge
                ? "Virtual judge"
                : "Virtual mentor";

            return (
            <div key={person.id} className={`rounded-2xl border bg-white/[0.02] ${isBookableMentor ? "border-blue-400/30 p-6 shadow-[0_0_30px_rgba(59,130,246,0.08)]" : "border-white/10 p-4"}`}>
              <div className="flex items-start gap-4">
                {person.photo_url ? (
                  <img src={person.photo_url} alt={person.name} className={`${isBookableMentor ? "w-20 h-20" : "w-12 h-12"} rounded-xl object-cover flex-shrink-0`} />
                ) : (
                  <div className={`${isBookableMentor ? "w-20 h-20" : "w-12 h-12"} rounded-xl bg-white/10 flex items-center justify-center text-lg text-white flex-shrink-0`}>
                    {person.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`${isBookableMentor ? "text-base" : "text-sm"} text-white font-medium`}>{person.name}</p>
                    {person.is_mentor && (
                      <span className="text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border text-gray-400 bg-white/5 border-white/10">
                        {person.mentorship_mode === "in_person" ? "Mentor: In-person" : person.mentorship_mode === "hybrid" ? "Mentor: Hybrid" : "Mentor: Virtual"}
                      </span>
                    )}
                    {person.is_judge && (
                      <span className="text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border text-amber-400 bg-amber-400/10 border-amber-400/20">
                        Judge
                      </span>
                    )}
                  </div>
                  {(person.title || person.company) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {person.title}{person.title && person.company ? " · " : ""}{person.company}
                    </p>
                  )}
                  {person.bio && (
                    <p className={`text-xs text-gray-600 mt-1 ${isBookableMentor ? "line-clamp-3" : "line-clamp-1"}`}>{person.bio}</p>
                  )}
                </div>
                <div className="flex gap-3 shrink-0 mt-1">
                  <button onClick={() => handleEdit(person)} className="text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-white">Edit</button>
                  <button onClick={() => handleDelete(person)} className="text-[10px] uppercase tracking-[0.15em] text-red-400/80 hover:text-red-300">Delete</button>
                </div>
              </div>
              {isBookableMentor && (
                <div className="mt-5 rounded-[24px] border border-blue-400/20 bg-blue-400/[0.04] p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-blue-200 font-semibold">Virtual Sessions</p>
                      <p className="text-[11px] text-gray-500 mt-1">{bookingRoleLabel}</p>
                    </div>
                    <p className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[11px] text-blue-100">
                      {bookedCount}/{capacityCount} booked
                    </p>
                  </div>
                  {personSlots.length === 0 ? (
                    <p className="text-xs text-gray-600">No availability slots set.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {personSlots.map((slot) => (
                        <div key={slot.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-gray-200">
                                {formatTime(slot.starts_at, timezone)} - {formatTime(slot.ends_at, timezone)}
                              </p>
                              <p className="text-[11px] text-gray-600 mt-1">
                                {slot.signup_count}/{slot.capacity} booked{slot.description ? ` · ${slot.description}` : ""}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                handleEdit(person);
                                handleEditSlot(slot);
                              }}
                              className="text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-white"
                            >
                              Edit Slot
                            </button>
                          </div>
                          {slot.attendees.length > 0 ? (
                            <div className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                              {slot.attendees.map((attendee) => (
                                <p key={attendee.id} className="text-xs text-gray-300">
                                  {attendee.name}{attendee.email ? ` (${attendee.email})` : ""}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-700 mt-2">Open slot</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
