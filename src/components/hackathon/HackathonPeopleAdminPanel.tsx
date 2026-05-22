"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMentor, updateMentor, deleteMentor } from "@/lib/actions/mentors";
import type { Event, Mentor } from "@/types";

type PersonFormState = {
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
  isJudge: boolean;
};

const emptyForm = (): PersonFormState => ({
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
  isJudge: false,
});

interface Props {
  event: Event;
  adminCode: string;
  initialPeople: Mentor[];
}

export function HackathonPeopleAdminPanel({ event, adminCode, initialPeople }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonFormState>(emptyForm());
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [filterTab, setFilterTab] = useState<"all" | "mentors" | "judges">("all");

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-700 focus:outline-none focus:border-white/20";

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleEdit = (person: Mentor) => {
    setEditingId(person.id);
    setForm({
      name: person.name,
      title: person.title || "",
      company: person.company || "",
      bio: person.bio || "",
      photoUrl: person.photo_url || "",
      meetLink: person.meet_link || "",
      mentorshipMode: person.mentorship_mode,
      inPersonLocation: person.in_person_location || "",
      inPersonSchedule: person.in_person_schedule || "",
      displayOrder: person.display_order,
      isJudge: person.is_judge,
    });
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

  const visiblePeople = initialPeople.filter((p) => {
    if (filterTab === "mentors") return !p.is_judge;
    if (filterTab === "judges") return p.is_judge;
    return true;
  });

  const mentorCount = initialPeople.filter((p) => !p.is_judge).length;
  const judgeCount = initialPeople.filter((p) => p.is_judge).length;

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="glass rounded-[32px] p-8 border-white/10 space-y-5">
        <div>
          <h3 className="text-xl font-light tracking-tight">
            {editingId ? "Edit Person" : "Add Person"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Add mentors and judges for the hackathon. Toggle &ldquo;Judge&rdquo; to move them to the judges page.
          </p>
        </div>

        {/* Judge toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${form.isJudge ? "bg-amber-500" : "bg-white/10"}`}
            onClick={() => setForm((f) => ({ ...f, isJudge: !f.isJudge }))}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.isJudge ? "translate-x-5" : "translate-x-1"}`} />
          </div>
          <span className="text-sm text-gray-300">
            {form.isJudge ? "Judge" : "Mentor"}
          </span>
          {form.isJudge && (
            <span className="text-[9px] uppercase tracking-[0.15em] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              Shows on Judges page
            </span>
          )}
        </label>

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
          {!form.isJudge && (
            <label className="space-y-2">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Mentorship Type</span>
              <select value={form.mentorshipMode} onChange={(e) => setForm({ ...form, mentorshipMode: e.target.value as PersonFormState["mentorshipMode"] })} className={inputClass}>
                <option value="virtual">Virtual (bookable)</option>
                <option value="in_person">In-person only</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
          )}
          {!form.isJudge && form.mentorshipMode !== "in_person" && (
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

        {!form.isJudge && (form.mentorshipMode === "in_person" || form.mentorshipMode === "hybrid") && (
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
          <button onClick={handleSubmit} disabled={isPending || !form.name.trim()} className="h-12 px-6 rounded-2xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-40">
            {editingId ? `Update ${form.isJudge ? "Judge" : "Mentor"}` : `Add ${form.isJudge ? "Judge" : "Mentor"}`}
          </button>
          {editingId && (
            <button onClick={resetForm} className="h-12 px-6 rounded-2xl border border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white">
              Cancel
            </button>
          )}
        </div>
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
          {visiblePeople.map((person) => (
            <div key={person.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start gap-4">
                {person.photo_url ? (
                  <img src={person.photo_url} alt={person.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-lg text-white flex-shrink-0">
                    {person.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white font-medium">{person.name}</p>
                    <span className={`text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${person.is_judge ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-gray-400 bg-white/5 border-white/10"}`}>
                      {person.is_judge ? "Judge" : person.mentorship_mode === "in_person" ? "In-person" : person.mentorship_mode === "hybrid" ? "Hybrid" : "Virtual"}
                    </span>
                  </div>
                  {(person.title || person.company) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {person.title}{person.title && person.company ? " · " : ""}{person.company}
                    </p>
                  )}
                  {person.bio && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-1">{person.bio}</p>
                  )}
                </div>
                <div className="flex gap-3 shrink-0 mt-1">
                  <button onClick={() => handleEdit(person)} className="text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-white">Edit</button>
                  <button onClick={() => handleDelete(person)} className="text-[10px] uppercase tracking-[0.15em] text-red-400/80 hover:text-red-300">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
