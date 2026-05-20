"use client";

import {
  useState, useEffect, useRef, useCallback, useTransition, useMemo,
} from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import {
  sendChatMessage, deleteChatMessage, pinChatMessage,
  toggleChatReaction, markChannelRead, loadMoreMessages, fetchChannelMessages,
} from "@/lib/actions/hackathon-chat";
import { sendTeamInvite } from "@/lib/actions/hackathon";
import { cn } from "@/lib/utils";
import {
  Hash, Lock, Megaphone, BookOpen, Users, X, Send,
  Paperclip, Smile, Pin, Trash2, ChevronUp, Shield,
  Star, ImageIcon, FileText, Download, AlertCircle, Zap, UserPlus,
  Linkedin,
} from "lucide-react";
import { getTeamRecommendations, type TeamRecommendation } from "@/lib/actions/hackathon-profiles";
import type {
  HackathonChatChannel, HackathonChatMessage, HackathonChatReaction,
  ChatMember, Event,
} from "@/types";

const QUICK_EMOJIS = ["👍", "🔥", "🚀", "💡", "❤️", "😂", "🎉", "⚡"];

interface Props {
  event: Event;
  userId: string;
  isAdmin: boolean;
  channels: HackathonChatChannel[];
  initialMessages: HackathonChatMessage[];
  initialChannelId: string;
  members: ChatMember[];
  myTeamId: string | null;
  needsTeam?: boolean;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({
  member, size = "sm",
}: {
  member: Pick<ChatMember, "id" | "name" | "team"> | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-10 h-10" : "w-12 h-12";
  const font = size === "sm" ? "text-[14px]" : "text-[16px]";
  const iconDim = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  const photo = member?.team?.icon_photo;
  if (photo?.status === "approved" && photo.file_url) {
    return (
      <div className={cn(dim, "rounded-2xl overflow-hidden shrink-0 relative bg-white/5 ring-1 ring-white/10")}>
        <Image src={photo.file_url} alt={member!.team!.name} fill className="object-cover" sizes="48px" />
      </div>
    );
  }

  // Initials fallback — colour derived from name
  const initials = member?.name
    ? member.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const hue = member?.name
    ? [...member.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    : 200;

  return (
    <div
      className={cn(dim, "rounded-2xl shrink-0 flex items-center justify-center text-white font-semibold shadow-inner", font)}
      style={{ 
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${hue}, 70%, 20%))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2)`
      }}
    >
      {member?.team?.icon_photo ? (
        <ImageIcon className={cn(iconDim, "text-white/50")} />
      ) : (
        initials
      )}
    </div>
  );
}

// ─── Member hover card ────────────────────────────────────────────────────────

function MemberCard({ member }: { member: ChatMember }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/80 p-5 w-64 space-y-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] z-50 backdrop-blur-3xl">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:15px_15px]" />
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-[40px]" />
      
      <div className="relative flex items-center gap-4">
        <div className="ring-1 ring-white/15 rounded-2xl shadow-lg">
          <Avatar member={member} size="md" />
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-bold truncate text-white tracking-tight">{member.name}</p>
          {member.role === "admin" || member.role === "staff" || member.role === "facilitator" ? (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 flex items-center gap-1 drop-shadow-md">
              <Shield className="w-3 h-3" /> Admin
            </span>
          ) : member.team_role === "leader" ? (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400 flex items-center gap-1 drop-shadow-md">
              <Star className="w-3 h-3" /> Team Lead
            </span>
          ) : null}
        </div>
      </div>
      {member.team && (
        <div className="relative border-t border-white/10 pt-4 flex items-center gap-3">
          <div className="ring-1 ring-white/15 rounded-2xl shadow-sm">
            <Avatar member={member} size="sm" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Team</p>
            <p className="text-[14px] font-bold text-gray-200 truncate mt-0.5">{member.team.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberProfileModal({
  member,
  onClose,
}: {
  member: ChatMember;
  onClose: () => void;
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
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close profile"
            >
              <X className="h-5 w-5" />
            </button>
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

// ─── Suggestion card (bot match recommendation) ───────────────────────────────

function SuggestionCard({
  msg, eventId, myTeamId,
}: {
  msg: HackathonChatMessage;
  eventId: string;
  myTeamId: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [teamName, setTeamName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  const suggestedName = msg.suggestion_user?.name ?? "them";

  const handleInvite = async (nameOverride?: string) => {
    if (!msg.suggestion_user_id) return;
    setStatus("pending");
    const res = await sendTeamInvite(eventId, msg.suggestion_user_id, nameOverride);
    if (res.error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("sent");
    }
  };

  const handleYes = () => {
    if (myTeamId) {
      handleInvite();
    } else {
      setShowNameInput(true);
    }
  };

  return (
    <div className="mx-3 my-4 sm:mx-6">
      <div className="relative overflow-hidden rounded-[28px] border border-red-500/40 bg-red-500/10 px-5 py-5 shadow-neon">
        <div className="absolute inset-0 bg-grid-red/[0.02] bg-[size:20px_20px]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/20 blur-[40px]" />
        
        <div className="relative flex items-start gap-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <Zap className="w-5 h-5 text-red-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-300 mb-1.5">Match Suggestion</p>
            <p className="text-[15px] font-medium text-gray-200 leading-relaxed">{msg.content}</p>

            {status === "sent" ? (
              <p className="mt-3 text-[13px] font-bold text-green-400">Invite sent to {suggestedName}!</p>
            ) : status === "error" ? (
              <p className="mt-3 text-[13px] font-bold text-red-400">Could not send invite — they may already be on a team.</p>
            ) : showNameInput && !myTeamId ? (
              <div className="mt-4 flex items-center gap-2">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name…"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-medium text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/50 focus:bg-black/60"
                />
                <button
                  disabled={!teamName.trim() || status === "pending"}
                  onClick={() => handleInvite(teamName.trim())}
                  className="px-5 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wider bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/30 hover:border-red-500/50 transition-all disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2">
                <button
                  disabled={status === "pending"}
                  onClick={handleYes}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wider bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/30 hover:border-red-500/50 transition-all disabled:opacity-40"
                >
                  <UserPlus className="w-4 h-4" />
                  {status === "pending" ? "Sending…" : `Yes, invite ${suggestedName}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team Finder Panel ────────────────────────────────────────────────────────

function TeamFinderPanel({
  eventId, myTeamId,
}: {
  eventId: string;
  myTeamId: string | null;
}) {
  const [recs, setRecs] = useState<TeamRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<Record<string, "idle" | "pending" | "sent" | "error">>({});
  const [teamNameInputs, setTeamNameInputs] = useState<Record<string, string>>({});
  const [showNameInput, setShowNameInput] = useState<string | null>(null);

  useEffect(() => {
    getTeamRecommendations(eventId).then((res) => {
      setRecs(res.recommendations);
      setLoading(false);
    });
  }, [eventId]);

  const handleInvite = async (userId: string, nameOverride?: string) => {
    setInviteStatus((s) => ({ ...s, [userId]: "pending" }));
    const res = await sendTeamInvite(eventId, userId, nameOverride);
    if (res.error) {
      setInviteStatus((s) => ({ ...s, [userId]: "error" }));
      setTimeout(() => setInviteStatus((s) => ({ ...s, [userId]: "idle" })), 3000);
    } else {
      setInviteStatus((s) => ({ ...s, [userId]: "sent" }));
      setShowNameInput(null);
    }
  };

  const handleYes = (userId: string) => {
    if (myTeamId) {
      handleInvite(userId);
    } else {
      setShowNameInput(userId);
    }
  };

  if (dismissed || (!loading && recs.length === 0)) return null;

  return (
    <div className="shrink-0 mx-3 mt-3 sm:mx-5">
      <div className="relative overflow-hidden rounded-[28px] border border-red-500/30 bg-red-500/[0.07] p-4 shadow-[0_0_40px_rgba(239,68,68,0.08)]">
        <div className="absolute inset-0 bg-grid-white/[0.01] bg-[size:15px_15px]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-[50px]" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/30">
                <Zap className="w-3.5 h-3.5 text-red-300" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-300">Team Finder</span>
              <span className="text-[10px] text-gray-500 font-medium">— your top matches</span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-600 hover:text-gray-400 transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3" role="status" aria-live="polite">
              <div className="flex items-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-red-200">
                <AlertCircle className="w-3.5 h-3.5" />
                suggestions loading!
              </div>
              <div className="flex gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex-1 h-20 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5">
              {recs.map((rec) => {
                const status = inviteStatus[rec.userId] ?? "idle";
                const teamName = teamNameInputs[rec.userId] ?? "";
                return (
                  <div
                    key={rec.userId}
                    className="flex-1 rounded-2xl border border-white/[0.06] bg-black/30 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] font-bold text-white leading-tight">{rec.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {rec.is_technical !== null && (
                          <span className={`text-[8px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${
                            rec.is_technical
                              ? "text-red-400 bg-red-500/10 border-red-500/20"
                              : "text-orange-400 bg-orange-500/10 border-orange-500/20"
                          }`}>
                            {rec.is_technical ? "Tech" : "Non-Tech"}
                          </span>
                        )}
                        {rec.linkedin_url && (
                          <a
                            href={rec.linkedin_url.startsWith("http") ? rec.linkedin_url : `https://${rec.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-red-400 transition-colors"
                          >
                            <Linkedin className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {rec.occupation && (
                      <p className="text-[10px] text-gray-500 font-medium leading-snug">{rec.occupation}</p>
                    )}
                    <p className="text-[12px] text-gray-300 leading-snug">{rec.reason}</p>

                    {status === "sent" ? (
                      <p className="text-[11px] font-bold text-green-400">Invite sent!</p>
                    ) : status === "error" ? (
                      <p className="text-[11px] font-bold text-red-400">Could not send invite</p>
                    ) : showNameInput === rec.userId && !myTeamId ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={teamName}
                          onChange={(e) => setTeamNameInputs((s) => ({ ...s, [rec.userId]: e.target.value }))}
                          placeholder="Team name…"
                          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50"
                        />
                        <button
                          disabled={!teamName.trim() || status === "pending"}
                          onClick={() => handleInvite(rec.userId, teamName.trim())}
                          className="px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/30 transition-all disabled:opacity-40"
                        >
                          Go
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={status === "pending"}
                        onClick={() => handleYes(rec.userId)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-red-500/15 border border-red-500/25 text-red-200 hover:bg-red-500/25 hover:border-red-500/40 transition-all disabled:opacity-40"
                      >
                        <UserPlus className="w-3 h-3" />
                        {status === "pending" ? "Sending…" : "Invite"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Channel icon helper ──────────────────────────────────────────────────────

function ChannelIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("w-3.5 h-3.5", className);
  if (type === "spawn_point") return <Zap className={cls} />;
  if (type === "announcements") return <Megaphone className={cls} />;
  if (type === "team") return <Lock className={cls} />;
  if (type === "resources") return <BookOpen className={cls} />;
  return <Hash className={cls} />;
}

// ─── Individual message ───────────────────────────────────────────────────────

function ChatMsg({
  msg, userId, isAdmin, members, memberMap, isGrouped, onReact, onDelete, onPin, onOpenProfile,
}: {
  msg: HackathonChatMessage;
  userId: string;
  isAdmin: boolean;
  members: ChatMember[];
  memberMap: Map<string, ChatMember>;
  isGrouped: boolean;
  onReact: (msgId: string, emoji: string) => void;
  onDelete: (msgId: string) => void;
  onPin: (msgId: string, pinned: boolean) => void;
  onOpenProfile: (member: ChatMember) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const sender = memberMap.get(msg.user_id);
  const isMine = msg.user_id === userId;
  const canDelete = isMine || isAdmin;
  const canPin = isAdmin;

  const senderIsAdmin =
    sender?.role === "admin" || sender?.role === "staff" || sender?.role === "facilitator";

  // Group reactions by emoji
  const reactions = useMemo(() => {
    const map: Record<string, { emoji: string; count: number; mine: boolean }> = {};
    for (const r of msg.reactions ?? []) {
      if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
      map[r.emoji].count++;
      if (r.user_id === userId) map[r.emoji].mine = true;
    }
    return Object.values(map);
  }, [msg.reactions, userId]);

  // Render content with @mention highlighting
  const renderContent = (text: string) => {
    const parts = text.split(/(@\w[\w\s]*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const mentioned = members.find(
          (m) => part.toLowerCase() === `@${m.name.toLowerCase()}`
        );
        if (mentioned) {
          return (
            <span key={i} className="bg-red-500/20 text-red-300 rounded-md px-1 py-0.5 font-medium border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-3 rounded-[24px] transition-all duration-300 sm:gap-4 sm:px-6 mx-2",
        isGrouped ? "py-1.5" : "pt-5 pb-2 mt-2",
        showActions && "bg-white/[0.04] shadow-inner",
        msg.is_pinned && "bg-yellow-500/[0.05] border border-yellow-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        !showActions && !msg.is_pinned && "hover:bg-white/[0.02]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); }}
    >
      {/* Avatar column */}
      <div className="w-10 shrink-0 flex flex-col items-center">
        {!isGrouped ? (
          <button
            type="button"
            className="relative cursor-pointer mt-0.5"
            onMouseEnter={() => setShowCard(true)}
            onMouseLeave={() => setShowCard(false)}
            onClick={() => sender && onOpenProfile(sender)}
          >
            <div className="ring-1 ring-white/15 rounded-2xl shadow-lg">
              <Avatar member={sender ?? null} size="sm" />
            </div>
            {showCard && sender && (
              <div className="absolute left-12 top-0 z-50 pointer-events-none" ref={cardRef}>
                <MemberCard member={sender} />
              </div>
            )}
          </button>
        ) : (
          <span className="text-[11px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 w-full text-center leading-none select-none">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        {!isGrouped && (
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1.5 pr-10 sm:pr-0">
            <span
              className="max-w-[12rem] truncate text-[16px] font-semibold text-white cursor-pointer hover:underline sm:max-w-none tracking-tight"
              onMouseEnter={() => setShowCard(true)}
              onMouseLeave={() => setShowCard(false)}
              onClick={() => sender && onOpenProfile(sender)}
            >
              {sender?.name ?? "Unknown"}
            </span>
            {senderIsAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-red-500/20 text-red-200 rounded-md px-1.5 py-0.5 border border-red-400/25 shadow-[0_0_10px_rgba(239,68,68,0.15)]">
                Admin
              </span>
            )}
            {!senderIsAdmin && sender?.team_role === "leader" && (
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-yellow-300 flex items-center gap-0.5 bg-yellow-500/10 px-1.5 py-0.5 rounded-md border border-yellow-400/20">
                <Star className="w-2.5 h-2.5" />Lead
              </span>
            )}
            <span className="text-[12px] font-medium text-gray-400 ml-1">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {msg.is_pinned && (
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-300 flex items-center gap-1 ml-auto sm:ml-2">
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
          </div>
        )}

        {/* Text */}
        {msg.content && (
          <p className="whitespace-pre-wrap text-[16px] text-gray-100 leading-[1.65] break-words">
            {renderContent(msg.content)}
          </p>
        )}

        {/* Image */}
        {msg.file_url && msg.file_type === "image" && (
          <div className="mt-2.5 max-w-full sm:max-w-sm">
            <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
              <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-white/15 shadow-md hover:border-white/25 transition-colors" style={{ maxHeight: 320 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={msg.file_url}
                  alt={msg.file_name ?? "Image"}
                  className="max-w-full max-h-80 object-contain"
                />
              </div>
            </a>
          </div>
        )}

        {/* File */}
        {msg.file_url && msg.file_type === "file" && (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex max-w-full items-center gap-3 bg-black/45 border border-white/15 rounded-2xl px-4 py-3 text-[15px] text-gray-100 hover:text-white hover:bg-white/[0.07] hover:border-white/25 transition-all duration-200 shadow-sm group"
          >
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors">
              <FileText className="w-4 h-4 shrink-0" />
            </div>
            <span className="min-w-0 truncate max-w-[200px] font-medium">{msg.file_name ?? "File"}</span>
            {msg.file_size_bytes && (
              <span className="text-[12px] font-medium text-gray-400 shrink-0">
                {(msg.file_size_bytes / 1024).toFixed(0)}KB
              </span>
            )}
            <Download className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors shrink-0 ml-1" />
          </a>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(msg.id, r.emoji)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-all duration-200 border",
                  r.mine
                    ? "bg-red-500/20 border-red-500/30 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                    : "bg-white/[0.05] border-white/[0.1] text-gray-300 hover:bg-white/[0.1] hover:text-white"
                )}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action toolbar (appears on hover) */}
      {showActions && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-2xl bg-black/85 p-1 opacity-100 backdrop-blur-xl border border-white/15 shadow-xl transition-all duration-200 sm:static sm:shrink-0 sm:bg-transparent sm:p-0 sm:opacity-0 sm:backdrop-blur-none sm:border-none sm:shadow-none sm:group-hover:opacity-100">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmoji && (
              <div className="absolute right-0 bottom-full mb-2 glass rounded-2xl p-2 border border-white/20 flex gap-1 z-50 shadow-2xl bg-black/85 backdrop-blur-3xl">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}
                    className="text-xl hover:scale-125 transition-transform w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canPin && (
            <button
              onClick={() => onPin(msg.id, !msg.is_pinned)}
              className={cn(
                "p-2 rounded-xl hover:bg-white/10 transition-colors",
                msg.is_pinned ? "text-yellow-300" : "text-gray-300 hover:text-white"
              )}
              title={msg.is_pinned ? "Unpin" : "Pin"}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(msg.id)}
              className="p-2 rounded-xl hover:bg-red-500/10 text-gray-300 hover:text-red-300 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main HackathonChat component ─────────────────────────────────────────────

export function HackathonChat({
  event, userId, isAdmin, channels: initialChannels,
  initialMessages, initialChannelId, members, myTeamId,
}: Props) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeChannelId, setActiveChannelId] = useState(initialChannelId);
  const [messageMap, setMessageMap] = useState<Record<string, HackathonChatMessage[]>>({
    [initialChannelId]: initialMessages,
  });
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 60);
  const [showMembers, setShowMembers] = useState(false);
  const [profileMember, setProfileMember] = useState<ChatMember | null>(null);
  const [isPending, startTransition] = useTransition();

  // Input state
  const [draft, setDraft] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasAttemptedChannelRestoreRef = useRef(false);
  const [hasRestoredChannel, setHasRestoredChannel] = useState(false);
  const storageKey = `hackathon-chat:${event.id}:active-channel`;

  // If active channel is missing (e.g. empty initialChannelId), fall back to first channel
  const resolvedChannelId = activeChannelId || channels[0]?.id || "";
  const currentChannel = channels.find((c) => c.id === resolvedChannelId);
  const messages = messageMap[resolvedChannelId] ?? [];

  // Build member lookup map
  const memberMap = useMemo(() => {
    const m = new Map<string, ChatMember>();
    for (const member of members) m.set(member.id, member);
    return m;
  }, [members]);

  const canSeeChannel = useCallback((channel: HackathonChatChannel) => {
    if (channel.channel_type === "dm") return false;
    return !channel.team_id || channel.team_id === myTeamId || isAdmin;
  }, [isAdmin, myTeamId]);

  const getChannelLabel = useCallback((channel: HackathonChatChannel | undefined) => {
    if (!channel) return "";
    if (channel.channel_type === "spawn_point") return "Spawn Point";
    return channel.name;
  }, []);

  // Group members by team for the sidebar
  const membersByTeam = useMemo(() => {
    const withTeam: ChatMember[] = [];
    const noTeam: ChatMember[] = [];
    const teamOrder: string[] = [];
    const grouped: Record<string, ChatMember[]> = {};

    for (const m of members) {
      if (m.team) {
        if (!grouped[m.team.id]) {
          grouped[m.team.id] = [];
          teamOrder.push(m.team.id);
        }
        grouped[m.team.id].push(m);
      } else {
        noTeam.push(m);
      }
    }

    return { grouped, teamOrder, noTeam };
  }, [members]);

  // Check if user can post in this channel
  const canPost = useMemo(() => {
    // No channel loaded yet — don't block, channels may still be initialising
    if (!currentChannel) return channels.length === 0 ? false : true;
    if (currentChannel.channel_type === "dm") return false;
    if (currentChannel.channel_type === "announcements") return isAdmin;
    // Spawn Point: only unassigned members (no team yet) can post
    if (currentChannel.channel_type === "spawn_point") return !myTeamId || isAdmin;
    if (currentChannel.team_id) {
      const myMember = memberMap.get(userId);
      return isAdmin || myMember?.team?.id === currentChannel.team_id;
    }
    // general / resources — all signed-in attendees can post
    return true;
  }, [currentChannel, channels.length, isAdmin, memberMap, myTeamId, userId]);

  const scrollToBottom = useCallback((smooth = false) => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Keep page-level navigation at the top; chat auto-scroll should only affect the message pane.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // Keep the selected channel stable across refreshes so non-default channel messages
  // don't appear to disappear when the page reloads back to #general.
  useEffect(() => {
    if (hasAttemptedChannelRestoreRef.current || channels.length === 0) return;
    hasAttemptedChannelRestoreRef.current = true;

    const storedChannelId = window.localStorage.getItem(storageKey);

    if (
      !storedChannelId ||
      storedChannelId === resolvedChannelId ||
      !channels.some((channel) => channel.id === storedChannelId)
    ) {
      setHasRestoredChannel(true);
      return;
    }

    setActiveChannelId(storedChannelId);
    if (!messageMap[storedChannelId]) {
      setLoadingChannel(true);
      fetchChannelMessages(storedChannelId)
        .then((msgs) => {
          setMessageMap((prev) => ({ ...prev, [storedChannelId]: msgs }));
          setHasMore(msgs.length >= 60);
        })
        .finally(() => setLoadingChannel(false));
    }
    setHasRestoredChannel(true);
    // Run once after channels are available; messageMap is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, resolvedChannelId, storageKey]);

  useEffect(() => {
    if (!hasRestoredChannel || !resolvedChannelId) return;
    window.localStorage.setItem(storageKey, resolvedChannelId);
  }, [hasRestoredChannel, resolvedChannelId, storageKey]);

  // Auto-scroll on new messages only if near bottom
  const isNearBottom = useCallback(() => {
    if (!listRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    return scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`hackathon-chat-${event.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hackathon_chat_messages", filter: `event_id=eq.${event.id}` },
        (payload) => {
          const newMsg = payload.new as HackathonChatMessage;
          setMessageMap((prev) => {
            const existing = prev[newMsg.channel_id] ?? [];
            if (existing.some((m) => m.id === newMsg.id)) return prev;
            return { ...prev, [newMsg.channel_id]: [...existing, newMsg] };
          });
          if (newMsg.channel_id === activeChannelId && isNearBottom()) {
            requestAnimationFrame(() => scrollToBottom(true));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "hackathon_chat_messages", filter: `event_id=eq.${event.id}` },
        (payload) => {
          const updated = payload.new as HackathonChatMessage;
          setMessageMap((prev) => {
            const existing = prev[updated.channel_id] ?? [];
            return {
              ...prev,
              [updated.channel_id]: updated.deleted_at
                ? existing.filter((m) => m.id !== updated.id)
                : existing.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
            };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hackathon_chat_reactions" },
        () => {
          // Re-fetch reactions for the active channel on reaction changes
          // Lightweight: just refresh the reactions on current messages
          setMessageMap((prev) => ({ ...prev })); // force re-render, real data via subscription
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hackathon_chat_channels", filter: `event_id=eq.${event.id}` },
        (payload) => {
          const ch = payload.new as HackathonChatChannel;
          // Only add if user should see it (public, their team, or their DM)
          if (canSeeChannel(ch)) {
            setChannels((prev) => [...prev, ch]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event.id, activeChannelId, canSeeChannel, isNearBottom, scrollToBottom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    scrollToBottom();
  }, [activeChannelId, scrollToBottom]);

  // Mark channel as read when switching to it
  useEffect(() => {
    if (resolvedChannelId) markChannelRead(resolvedChannelId).catch(() => {});
  }, [resolvedChannelId]);

  const switchChannel = async (channelId: string) => {
    if (channelId === resolvedChannelId) return;
    setActiveChannelId(channelId);
    if (!messageMap[channelId]) {
      setLoadingChannel(true);
      const msgs = await fetchChannelMessages(channelId);
      setMessageMap((prev) => ({ ...prev, [channelId]: msgs }));
      setHasMore(msgs.length >= 60);
      setLoadingChannel(false);
    }
  };

  const handleLoadMore = async () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    const older = await loadMoreMessages(resolvedChannelId, oldest.id);
    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: [...older, ...(prev[resolvedChannelId] ?? [])],
    }));
    setHasMore(older.length >= 40);
    setLoadingMore(false);
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isPending) return;

    // Parse mentions from text
    const mentioned: string[] = [];
    for (const m of members) {
      if (text.toLowerCase().includes(`@${m.name.toLowerCase()}`)) {
        mentioned.push(m.id);
      }
    }

    const optimisticId = `opt-${Date.now()}`;
    const optimistic: HackathonChatMessage = {
      id: optimisticId,
      channel_id: resolvedChannelId,
      event_id: event.id,
      user_id: userId,
      content: text,
      file_url: null, file_type: null, file_name: null, file_size_bytes: null,
      is_pinned: false,
      mentioned_user_ids: mentioned,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_system_message: false,
      suggestion_user_id: null,
      user: memberMap.get(userId) ? { id: userId, name: memberMap.get(userId)!.name } : undefined,
      reactions: [],
    };

    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: [...(prev[resolvedChannelId] ?? []), optimistic],
    }));
    setDraft("");
    requestAnimationFrame(() => scrollToBottom(true));

    startTransition(async () => {
      try {
        const res = await sendChatMessage(resolvedChannelId, event.id, text, mentioned);
        if (res.error) {
          setMessageMap((prev) => ({
            ...prev,
            [resolvedChannelId]: (prev[resolvedChannelId] ?? []).filter((m) => m.id !== optimisticId),
          }));
          setDraft(text);
          toast.error(res.error);
        } else if (res.message) {
          setMessageMap((prev) => ({
            ...prev,
            [resolvedChannelId]: (prev[resolvedChannelId] ?? []).map((m) =>
              m.id === optimisticId ? { ...res.message!, reactions: [] } : m
            ),
          }));
        }
      } catch (err) {
        setMessageMap((prev) => ({
          ...prev,
          [resolvedChannelId]: (prev[resolvedChannelId] ?? []).filter((m) => m.id !== optimisticId),
        }));
        setDraft(text);
        toast.error(err instanceof Error ? err.message : "Message failed to send");
      }
    });
  };

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("eventId", event.id);
      fd.append("channelId", resolvedChannelId);
      const res = await fetch("/api/hackathon/chat-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }

      startTransition(async () => {
        const result = await sendChatMessage(
          resolvedChannelId, event.id,
          draft.trim() || null, [],
          data.file_url, data.file_type, data.file_name, data.file_size_bytes
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.message) {
          setMessageMap((prev) => {
            const existing = prev[resolvedChannelId] ?? [];
            if (existing.some((m) => m.id === result.message!.id)) return prev;
            return {
              ...prev,
              [resolvedChannelId]: [...existing, { ...result.message!, reactions: result.message!.reactions ?? [] }],
            };
          });
          requestAnimationFrame(() => scrollToBottom(true));
        }
        setDraft("");
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleReact = (msgId: string, emoji: string) => {
    setMessageMap((prev) => {
      const msgs = prev[resolvedChannelId] ?? [];
      return {
        ...prev,
        [resolvedChannelId]: msgs.map((m) => {
          if (m.id !== msgId) return m;
          const reactions = m.reactions ?? [];
          const existing = reactions.find((r) => r.emoji === emoji && r.user_id === userId);
          const next: HackathonChatReaction[] = existing
            ? reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId))
            : [...reactions, { id: `opt-${Date.now()}`, message_id: msgId, user_id: userId, emoji, created_at: new Date().toISOString() }];
          return { ...m, reactions: next };
        }),
      };
    });
    startTransition(async () => { await toggleChatReaction(msgId, emoji); });
  };

  const handleDelete = (msgId: string) => {
    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).filter((m) => m.id !== msgId),
    }));
    startTransition(async () => { await deleteChatMessage(msgId); });
  };

  const handlePin = (msgId: string, pinned: boolean) => {
    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).map((m) =>
        m.id === msgId ? { ...m, is_pinned: pinned } : m
      ),
    }));
    startTransition(async () => { await pinChatMessage(msgId, pinned); });
  };

  // Textarea auto-grow + mention detection
  const handleDraftChange = (v: string, pos: number) => {
    setDraft(v);
    setCursorPos(pos);
    // Detect @mention trigger
    const before = v.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
    }
  };

  const insertMention = (member: ChatMember) => {
    const before = draft.slice(0, cursorPos);
    const after = draft.slice(cursorPos);
    const prefix = before.replace(/@(\w*)$/, `@${member.name} `);
    setDraft(prefix + after);
    setShowMentionPicker(false);
    inputRef.current?.focus();
  };

  const filteredMentions = members.filter(
    (m) => m.name.toLowerCase().startsWith(mentionQuery) && m.id !== userId
  ).slice(0, 6);

  // Compute message grouping (group consecutive same-user messages within 5 min)
  const groupedMessages = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const isGrouped =
        !!prev &&
        prev.user_id === msg.user_id &&
        !prev.deleted_at &&
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
      return { msg, isGrouped };
    });
  }, [messages]);

  return (
    <div className="relative flex h-[calc(100dvh-11rem)] min-h-[30rem] flex-col overflow-hidden rounded-[34px] bg-black/50 backdrop-blur-3xl border border-white/10 animate-fade-in sm:h-[calc(100vh-12rem)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]">
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-screen" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
      
      {/* Subtle top gradient light */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
      <div className="absolute -top-20 right-10 h-52 w-52 rounded-full bg-red-500/[0.08] blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-red-500/[0.05] blur-[80px] pointer-events-none" />

      {/* Channel nav */}
      <div className="relative flex items-center gap-2 border-b border-white/10 bg-black/40 px-3 pt-3 pb-2.5 shrink-0 sm:px-4 z-10 backdrop-blur-md">
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex w-max flex-nowrap gap-2 pr-1">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 border",
                  ch.id === resolvedChannelId
                    ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] scale-105"
                    : "bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
                )}
              >
                <ChannelIcon type={ch.channel_type} className={cn(
                  "transition-colors duration-300",
                  ch.id === resolvedChannelId ? "text-white" : "text-gray-500"
                )} />
                {getChannelLabel(ch)}
              </button>
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold uppercase tracking-wider transition-all duration-300 border",
              showMembers
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] scale-105"
                : "bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
            )}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{members.length}</span>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Channel header */}
          <div className="relative flex items-center gap-3 border-b border-white/10 bg-black/40 px-5 py-4 shrink-0 z-10 backdrop-blur-md">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
              <ChannelIcon type={currentChannel?.channel_type ?? "general"} className="text-gray-300 w-5 h-5" />
            </div>
            <span className="min-w-0 truncate text-[18px] font-bold text-white tracking-tight">{getChannelLabel(currentChannel)}</span>
            {currentChannel?.channel_type === "spawn_point" && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300 bg-yellow-500/20 px-2.5 py-1 rounded-full ml-1 border border-yellow-500/30">Unassigned</span>
            )}
            {currentChannel?.channel_type === "announcements" && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 bg-red-500/20 px-2.5 py-1 rounded-full ml-1 border border-red-500/30">Admin Only</span>
            )}
            {currentChannel?.channel_type === "team" && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 bg-red-500/20 px-2.5 py-1 rounded-full ml-1 border border-red-500/30">Private Team</span>
            )}
            <span className="ml-auto hidden text-[12px] font-bold uppercase tracking-wider text-gray-500 sm:inline">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
          </div>

          {currentChannel?.channel_type === "spawn_point" && !myTeamId && !isAdmin && (
            <TeamFinderPanel eventId={event.id} myTeamId={myTeamId} />
          )}

          {/* Message list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-3 pb-5 space-y-0 scrollbar-hide"
          >
            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.045] border border-white/[0.1] text-[12px] font-semibold uppercase tracking-[0.1em] text-gray-300 hover:text-white hover:bg-white/[0.08] hover:border-white/25 transition-all duration-300 disabled:opacity-40 shadow-sm"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  {loadingMore ? "Loading…" : "Load older messages"}
                </button>
              </div>
            )}

            {loadingChannel && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              </div>
            )}

            {!loadingChannel && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] border border-white/10 bg-white/5 mb-6 shadow-2xl">
                  <div className="absolute inset-0 rounded-[32px] bg-red-500/10 blur-xl" />
                  <ChannelIcon type={currentChannel?.channel_type ?? "general"} className="w-10 h-10 text-gray-400" />
                </div>
                {currentChannel?.channel_type === "spawn_point" ? (
                  <>
                    <p className="text-2xl font-black tracking-tight text-white">Welcome to Spawn Point</p>
                    <p className="text-[15px] font-medium text-gray-400 mt-2 max-w-[280px] leading-relaxed">Introduce yourself while you wait to be assigned to a team.</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-black tracking-tight text-white">No messages yet</p>
                    <p className="text-[15px] font-medium text-gray-400 mt-2">Be the first to say something!</p>
                  </>
                )}
              </div>
            )}

            {groupedMessages.map(({ msg, isGrouped }) =>
              msg.is_system_message && msg.suggestion_user_id ? (
                <SuggestionCard
                  key={msg.id}
                  msg={msg}
                  eventId={event.id}
                  myTeamId={myTeamId}
                />
              ) : (
                <ChatMsg
                  key={msg.id}
                  msg={msg}
                  userId={userId}
                  isAdmin={isAdmin}
                  members={members}
                  memberMap={memberMap}
                  isGrouped={isGrouped}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onPin={handlePin}
                  onOpenProfile={setProfileMember}
                />
              )
            )}
            <div ref={messagesEndRef} className="h-6 shrink-0" />
          </div>

          {/* Input area */}
          <div className="px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0 sm:px-5 sm:pb-5 relative z-10">
            {/* Input top gradient fade */}
            <div className="absolute bottom-full left-0 right-0 h-10 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
            {!canPost ? (
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[15px] font-medium text-gray-300 shadow-inner">
                <AlertCircle className="w-5 h-5 text-gray-400" />
                {currentChannel?.channel_type === "announcements"
                  ? "Only admins can post in announcements"
                  : currentChannel?.channel_type === "spawn_point"
                    ? "You're on a team now — chat in #general or your team channel"
                    : channels.length === 0
                      ? "Chat channels not set up — run the SQL migration in Supabase"
                      : "Only team members can post in this channel"}
              </div>
            ) : (
              <div className="relative">
                {showMentionPicker && filteredMentions.length > 0 && (
                  <div className="absolute bottom-full mb-3 left-0 right-0 rounded-[28px] border border-white/10 overflow-hidden z-50 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-3xl bg-black/80">
                    {filteredMentions.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => insertMention(m)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/10 transition-colors text-left border-b border-white/[0.05] last:border-0 group"
                      >
                        <div className="ring-1 ring-white/15 rounded-2xl shadow-sm">
                          <Avatar member={m} size="sm" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-gray-100 group-hover:text-white transition-colors">{m.name}</p>
                          {m.team && (
                            <p className="text-[12px] font-medium text-gray-400">{m.team.name}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-[28px] border border-white/20 bg-black/60 backdrop-blur-2xl px-4 py-4 transition-all duration-300 focus-within:border-red-500/50 focus-within:bg-black/80 focus-within:shadow-[0_0_30px_rgba(239,68,68,0.15)] sm:gap-3 sm:px-5 shadow-inner">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value, e.target.selectionStart ?? 0)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                      if (e.key === "Escape") {
                        setShowMentionPicker(false);
                      }
                    }}
                    placeholder={
                      currentChannel?.channel_type === "team"
                        ? `Message your team…`
                        : currentChannel?.channel_type === "spawn_point"
                          ? `Introduce yourself in Spawn Point…`
                          : `Message #${currentChannel ? getChannelLabel(currentChannel) : "…"}`
                    }
                    rows={1}
                    className="min-w-0 flex-1 resize-none bg-transparent text-[16px] font-medium leading-relaxed text-white placeholder-gray-500 focus:outline-none max-h-32 py-1"
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
                  <div className="flex items-center gap-2 shrink-0 pb-0.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="p-3 rounded-[20px] text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-40"
                      title="Attach file"
                    >
                      {uploadingFile ? (
                        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/90 animate-spin" />
                      ) : (
                        <Paperclip className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!draft.trim() || isPending}
                      className="p-3 rounded-[20px] bg-white text-black hover:bg-gray-200 hover:scale-105 transition-all duration-200 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2.5 ml-4 hidden text-[11px] font-bold uppercase tracking-wider text-gray-500 sm:block">
                  <span className="text-gray-400">Enter</span> to send · <span className="text-gray-400">Shift+Enter</span> for new line · <span className="text-gray-400">@name</span> to mention
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Members sidebar */}
        {showMembers && (
          <button
            type="button"
            aria-label="Close members panel"
            className="absolute inset-0 z-20 bg-black/35 sm:hidden"
            onClick={() => setShowMembers(false)}
          />
        )}
        {showMembers && (
          <div className="absolute inset-y-0 right-0 z-30 flex w-[min(19.5rem,88vw)] shrink-0 flex-col overflow-hidden border-l border-white/[0.1] bg-black/70 backdrop-blur-3xl shadow-[-24px_0_50px_rgba(0,0,0,0.65)] sm:relative sm:z-auto sm:w-72 sm:shadow-none">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.035] shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">
                Members — {members.length}
              </span>
              <button
                onClick={() => setShowMembers(false)}
                className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 scrollbar-hide px-2.5">
              {/* Admin / staff first */}
              {members.filter((m) => ["admin", "staff", "facilitator"].includes(m.role)).length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-200 px-3 mb-2">Organizers</p>
                  {members
                    .filter((m) => ["admin", "staff", "facilitator"].includes(m.role))
                    .map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        onOpenProfile={setProfileMember}
                      />
                    ))}
                </div>
              )}

              {/* Teams */}
              {membersByTeam.teamOrder.map((teamId) => {
                const teamMembers = membersByTeam.grouped[teamId];
                const team = teamMembers[0]?.team;
                return (
                  <div key={teamId} className="mb-4">
                    <div className="flex items-center gap-2 px-3 mb-2">
                      {team?.icon_photo?.status === "approved" ? (
                        <div className="w-5 h-5 rounded-lg overflow-hidden relative shrink-0 ring-1 ring-white/15 shadow-sm">
                          <Image src={team.icon_photo.file_url} alt={team.name} fill className="object-cover" sizes="20px" />
                        </div>
                      ) : null}
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 truncate">
                        {team?.name ?? "Team"}
                      </p>
                    </div>
                    {teamMembers.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        onOpenProfile={setProfileMember}
                      />
                    ))}
                  </div>
                );
              })}

              {/* No team */}
              {membersByTeam.noTeam.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 px-3 mb-2">No Team</p>
                  {membersByTeam.noTeam
                    .filter((m) => !["admin", "staff", "facilitator"].includes(m.role))
                    .map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        onOpenProfile={setProfileMember}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {profileMember && (
        <MemberProfileModal
          member={profileMember}
          onClose={() => setProfileMember(null)}
        />
      )}
    </div>
  );
}

// ─── Member row in sidebar ────────────────────────────────────────────────────

function MemberRow({
  member,
  onOpenProfile,
}: {
  member: ChatMember;
  onOpenProfile: (member: ChatMember) => void;
}) {
  const [showCard, setShowCard] = useState(false);

  return (
    <button
      type="button"
      className="relative flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.06] transition-all duration-200 cursor-pointer group text-left"
      onMouseEnter={() => setShowCard(true)}
      onMouseLeave={() => setShowCard(false)}
      onClick={() => onOpenProfile(member)}
    >
      <div className="ring-1 ring-white/15 rounded-2xl shadow-sm">
        <Avatar member={member} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-gray-100 truncate group-hover:text-white transition-colors">{member.name}</p>
        {member.team_role === "leader" && (
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-yellow-300">Lead</span>
        )}
      </div>
      {(member.role === "admin" || member.role === "staff" || member.role === "facilitator") && (
        <Shield className="w-4 h-4 text-red-200 shrink-0 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
      )}
      {showCard && (
        <div className="absolute left-full top-0 ml-2 z-50 pointer-events-none">
          <MemberCard member={member} />
        </div>
      )}
    </button>
  );
}
