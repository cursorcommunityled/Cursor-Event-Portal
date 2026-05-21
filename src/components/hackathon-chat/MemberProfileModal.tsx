"use client";

import { useEffect } from "react";
import { Check, Shield, Star, X, Linkedin, MessageSquare, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMember } from "@/types";
import { Avatar } from "./Avatar";

function ProfileField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl border border-white/10 bg-white/[0.035] p-4", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">{label}</p>
      <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-100">{value || "Not provided"}</p>
    </div>
  );
}

export function MemberProfileModal({
  member,
  onClose,
  onStartDM,
  onInvite,
  onCancelInvite,
  inviteStatus = "hidden",
}: {
  member: ChatMember;
  onClose: () => void;
  onStartDM?: (userId: string) => void;
  onInvite?: (member: ChatMember) => void;
  onCancelInvite?: (member: ChatMember) => void;
  inviteStatus?: "hidden" | "available" | "sent";
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isOrganizer = member.role === "admin" || member.role === "staff" || member.role === "facilitator";
  const linkedinUrl = member.linkedin_url
    ? member.linkedin_url.startsWith("http")
      ? member.linkedin_url
      : `https://${member.linkedin_url}`
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close profile"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[36px] border border-white/15 bg-black/90 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.85)]">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:18px_18px]" />
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-500/15 blur-[55px]" />
        <div className="relative space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="rounded-2xl ring-1 ring-white/15">
                <Avatar member={member} size="md" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-2xl font-black tracking-tight text-white">{member.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isOrganizer ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-200">
                      <Shield className="h-3 w-3" /> Organizer
                    </span>
                  ) : member.team_role === "leader" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-yellow-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-200">
                      <Star className="h-3 w-3" /> Team Lead
                    </span>
                  ) : null}
                  {!member.team && !isOrganizer && (
                    <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-200">
                      Looking for team
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {inviteStatus === "sent" ? (
                onCancelInvite ? (
                  <button
                    type="button"
                    onClick={() => onCancelInvite(member)}
                    className="group flex min-w-[106px] items-center justify-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-green-300 transition-all hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-200"
                    aria-label="Cancel invite"
                  >
                    <span className="flex items-center gap-2 group-hover:hidden">
                      <Check className="h-4 w-4" /> Invited
                    </span>
                    <span className="hidden group-hover:inline">Cancel Invite</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-green-300">
                    <Check className="h-4 w-4" /> Invited
                  </span>
                )
              ) : inviteStatus === "available" && onInvite ? (
                <button
                  type="button"
                  onClick={() => onInvite(member)}
                  className="flex items-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/15 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-red-200 transition-all hover:border-red-500/40 hover:bg-red-500/25 hover:scale-105"
                  aria-label="Invite to team"
                >
                  <UserPlus className="h-4 w-4" /> Invite
                </button>
              ) : null}
              {onStartDM && (
                <button
                  type="button"
                  onClick={() => onStartDM(member.id)}
                  className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/10 hover:scale-105"
                  aria-label="Direct Message"
                >
                  <MessageSquare className="h-4 w-4" /> Message
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close profile"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {member.team && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">Team</p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar member={member} size="sm" />
                <p className="min-w-0 truncate text-[16px] font-bold text-white">{member.team.name}</p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileField
              label="Background"
              value={
                member.is_technical === null || member.is_technical === undefined
                  ? null
                  : member.is_technical
                    ? "Technical"
                    : "Non-technical"
              }
            />
            <ProfileField label="Occupation" value={member.occupation} />
            <ProfileField label="Unique Skill" value={member.unique_skill} className="sm:col-span-2" />
            <ProfileField label="Short Bio" value={member.profile_bio} className="sm:col-span-2" />
            <ProfileField label="Project Interests" value={member.project_interests} className="sm:col-span-2" />
            <ProfileField label="Collaboration Style" value={member.collaboration_style} />
            <ProfileField label="Looking For" value={member.looking_for_teammates} />
          </div>

          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-[13px] font-bold uppercase tracking-[0.16em] text-blue-200 transition-all hover:border-blue-300/35 hover:bg-blue-500/20"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn Profile
            </a>
          )}
        </div>
      </div>
    </div>
  );
}