"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Check, Loader2, UserRound } from "lucide-react";
import { updateMyHackathonProfile, type HackathonProfileFormInput } from "@/lib/actions/hackathon-profiles";
import type { HackathonProfile } from "@/types";

function textValue(value: string | null | undefined) {
  return value ?? "";
}

export function HackathonProfileEditor({
  eventId,
  initialProfile,
  onSaved,
}: {
  eventId: string;
  initialProfile: HackathonProfile | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<HackathonProfileFormInput>({
    occupation: textValue(initialProfile?.occupation),
    is_technical: initialProfile?.is_technical ?? null,
    unique_skill: textValue(initialProfile?.unique_skill),
    linkedin_url: textValue(initialProfile?.linkedin_url),
    needs_team: initialProfile?.needs_team ?? false,
    profile_bio: textValue(initialProfile?.profile_bio),
    project_interests: textValue(initialProfile?.project_interests),
    collaboration_style: textValue(initialProfile?.collaboration_style),
    looking_for_teammates: textValue(initialProfile?.looking_for_teammates),
  });

  useEffect(() => {
    setForm({
      occupation: textValue(initialProfile?.occupation),
      is_technical: initialProfile?.is_technical ?? null,
      unique_skill: textValue(initialProfile?.unique_skill),
      linkedin_url: textValue(initialProfile?.linkedin_url),
      needs_team: initialProfile?.needs_team ?? false,
      profile_bio: textValue(initialProfile?.profile_bio),
      project_interests: textValue(initialProfile?.project_interests),
      collaboration_style: textValue(initialProfile?.collaboration_style),
      looking_for_teammates: textValue(initialProfile?.looking_for_teammates),
    });
  }, [initialProfile]);

  const updateField = <K extends keyof HackathonProfileFormInput>(
    key: K,
    value: HackathonProfileFormInput[K]
  ) => {
    setSaved(false);
    setError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setError(null);

    startTransition(async () => {
      const result = await updateMyHackathonProfile(eventId, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.profile) {
        setForm({
          occupation: textValue(result.profile.occupation),
          is_technical: result.profile.is_technical ?? null,
          unique_skill: textValue(result.profile.unique_skill),
          linkedin_url: textValue(result.profile.linkedin_url),
          needs_team: result.profile.needs_team,
          profile_bio: textValue(result.profile.profile_bio),
          project_interests: textValue(result.profile.project_interests),
          collaboration_style: textValue(result.profile.collaboration_style),
          looking_for_teammates: textValue(result.profile.looking_for_teammates),
        });
      }
      setSaved(true);
      onSaved?.();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/50 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
    >
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:24px_24px]" />
      <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-red-500/10 blur-[55px]" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-200">
                <UserRound className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-300">My Hackathon Profile</p>
            </div>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-gray-400">
              Add optional details teammates can see when they open your profile. Imported questionnaire answers stay editable here too.
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.16em] text-black transition-all hover:bg-gray-200 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Profile
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Occupation / role</span>
            <input
              value={textValue(form.occupation)}
              onChange={(event) => updateField("occupation", event.target.value)}
              maxLength={120}
              placeholder="Founder, designer, data analyst..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Background</span>
            <select
              value={form.is_technical === null || form.is_technical === undefined ? "" : form.is_technical ? "technical" : "non-technical"}
              onChange={(event) => updateField(
                "is_technical",
                event.target.value === "" ? null : event.target.value === "technical"
              )}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-medium text-white focus:border-red-500/40 focus:outline-none"
            >
              <option value="">Prefer not to say</option>
              <option value="technical">Technical</option>
              <option value="non-technical">Non-technical</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Unique skill</span>
            <input
              value={textValue(form.unique_skill)}
              onChange={(event) => updateField("unique_skill", event.target.value)}
              maxLength={160}
              placeholder="Pitching, React, user research..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">LinkedIn URL</span>
            <input
              value={textValue(form.linkedin_url)}
              onChange={(event) => updateField("linkedin_url", event.target.value)}
              maxLength={240}
              placeholder="https://linkedin.com/in/..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Short bio</span>
            <textarea
              value={textValue(form.profile_bio)}
              onChange={(event) => updateField("profile_bio", event.target.value)}
              maxLength={600}
              rows={3}
              placeholder="A quick intro for potential teammates..."
              className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Project interests</span>
            <textarea
              value={textValue(form.project_interests)}
              onChange={(event) => updateField("project_interests", event.target.value)}
              maxLength={600}
              rows={2}
              placeholder="Industries, ideas, or problems you want to work on..."
              className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Collaboration style</span>
              <textarea
                value={textValue(form.collaboration_style)}
                onChange={(event) => updateField("collaboration_style", event.target.value)}
                maxLength={400}
                rows={2}
                placeholder="Fast prototyper, facilitator, detail-oriented..."
                className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Looking for teammates who...</span>
              <textarea
                value={textValue(form.looking_for_teammates)}
                onChange={(event) => updateField("looking_for_teammates", event.target.value)}
                maxLength={400}
                rows={2}
                placeholder="Can design, validate users, build quickly..."
                className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 focus:border-red-500/40 focus:outline-none"
              />
            </label>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-medium text-gray-300">
          <input
            type="checkbox"
            checked={Boolean(form.needs_team)}
            onChange={(event) => updateField("needs_team", event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black accent-red-500"
          />
          Show me as looking for a team when organizers use profile data.
        </label>

        {saved && <p className="text-sm font-bold text-green-400">Profile saved.</p>}
        {error && <p className="text-sm font-bold text-red-300">{error}</p>}
      </div>
    </form>
  );
}
