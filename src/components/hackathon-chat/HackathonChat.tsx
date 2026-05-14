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
  ensureDirectChannel,
} from "@/lib/actions/hackathon-chat";
import { sendTeamInvite } from "@/lib/actions/hackathon";
import { cn } from "@/lib/utils";
import {
  Hash, Lock, Megaphone, BookOpen, Users, X, Send,
  Paperclip, Smile, Pin, Trash2, ChevronUp, Shield,
  Star, ImageIcon, FileText, Download, AlertCircle, MessageCircle, Zap, UserPlus,
} from "lucide-react";
import type {
  HackathonChatChannel, HackathonChatMessage, HackathonChatReaction,
  ChatMember, Event,
} from "@/types";

const QUICK_EMOJIS = ["👍", "🔥", "🚀", "💡", "❤️", "😂", "🎉", "⚡"];
const DIRECT_CHANNEL_PREFIX = "dm:";

function getDirectChannelUserIds(name: string) {
  if (!name.startsWith(DIRECT_CHANNEL_PREFIX)) return [];
  return name.slice(DIRECT_CHANNEL_PREFIX.length).split(":").filter(Boolean);
}

interface Props {
  event: Event;
  userId: string;
  isAdmin: boolean;
  channels: HackathonChatChannel[];
  initialMessages: HackathonChatMessage[];
  initialChannelId: string;
  members: ChatMember[];
  myTeamId: string | null;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({
  member, size = "sm",
}: {
  member: Pick<ChatMember, "id" | "name" | "team"> | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-9 h-9" : "w-11 h-11";
  const font = size === "sm" ? "text-[13px]" : "text-[15px]";
  const iconDim = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5";

  const photo = member?.team?.icon_photo;
  if (photo?.status === "approved" && photo.file_url) {
    return (
      <div className={cn(dim, "rounded-xl overflow-hidden shrink-0 relative bg-white/5")}>
        <Image src={photo.file_url} alt={member!.team!.name} fill className="object-cover" sizes="44px" />
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
      className={cn(dim, "rounded-xl shrink-0 flex items-center justify-center text-white/90 font-semibold shadow-inner", font)}
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
    <div className="glass rounded-2xl p-4 border border-white/10 w-56 space-y-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] z-50 bg-black/80 backdrop-blur-3xl">
      <div className="flex items-center gap-3">
        <div className="ring-1 ring-white/10 rounded-xl shadow-md">
          <Avatar member={member} size="md" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate text-white/95 tracking-tight">{member.name}</p>
          {member.role === "admin" || member.role === "staff" || member.role === "facilitator" ? (
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400 flex items-center gap-1 drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]">
              <Shield className="w-2.5 h-2.5" /> Admin
            </span>
          ) : member.team_role === "leader" ? (
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-yellow-500 flex items-center gap-1">
              <Star className="w-2.5 h-2.5" /> Team Lead
            </span>
          ) : null}
        </div>
      </div>
      {member.team && (
        <div className="border-t border-white/[0.08] pt-3 flex items-center gap-2.5">
          <div className="ring-1 ring-white/10 rounded-xl shadow-sm">
            <Avatar member={member} size="sm" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">Team</p>
            <p className="text-[13px] font-medium text-gray-200 truncate">{member.team.name}</p>
          </div>
        </div>
      )}
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
    <div className="mx-3 my-3 sm:mx-5">
      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.07] px-4 py-3.5 shadow-[0_0_20px_rgba(168,85,247,0.08)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/20">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400 mb-1">Match Suggestion</p>
            <p className="text-[14px] text-gray-200 leading-relaxed">{msg.content}</p>

            {status === "sent" ? (
              <p className="mt-2.5 text-[12px] text-green-400 font-medium">Invite sent to {suggestedName}!</p>
            ) : status === "error" ? (
              <p className="mt-2.5 text-[12px] text-red-400">Could not send invite — they may already be on a team.</p>
            ) : showNameInput && !myTeamId ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name…"
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-400/60"
                />
                <button
                  disabled={!teamName.trim() || status === "pending"}
                  onClick={() => handleInvite(teamName.trim())}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium bg-purple-500/30 border border-purple-400/40 text-purple-300 hover:bg-purple-500/50 transition-all disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  disabled={status === "pending"}
                  onClick={handleYes}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/25 border border-purple-400/40 text-purple-300 hover:bg-purple-500/40 transition-all disabled:opacity-40"
                >
                  <UserPlus className="w-3.5 h-3.5" />
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

// ─── Channel icon helper ──────────────────────────────────────────────────────

function ChannelIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("w-3.5 h-3.5", className);
  if (type === "spawn_point") return <Zap className={cls} />;
  if (type === "announcements") return <Megaphone className={cls} />;
  if (type === "team") return <Lock className={cls} />;
  if (type === "resources") return <BookOpen className={cls} />;
  if (type === "dm") return <MessageCircle className={cls} />;
  return <Hash className={cls} />;
}

// ─── Individual message ───────────────────────────────────────────────────────

function ChatMsg({
  msg, userId, isAdmin, members, memberMap, isGrouped, onReact, onDelete, onPin,
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
            <span key={i} className="bg-purple-500/20 text-purple-300 rounded-md px-1 py-0.5 font-medium border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
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
        "group relative flex gap-3 px-3 rounded-2xl transition-all duration-200 sm:gap-4 sm:px-5 mx-2",
        isGrouped ? "py-1.5" : "pt-5 pb-1.5 mt-2",
        showActions && "bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        msg.is_pinned && "bg-yellow-400/[0.03] border border-yellow-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        !showActions && !msg.is_pinned && "hover:bg-white/[0.02]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); }}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0 flex flex-col items-center">
        {!isGrouped ? (
          <div
            className="relative cursor-pointer mt-0.5"
            onMouseEnter={() => setShowCard(true)}
            onMouseLeave={() => setShowCard(false)}
          >
            <div className="ring-1 ring-white/10 rounded-xl shadow-lg">
              <Avatar member={sender ?? null} size="sm" />
            </div>
            {showCard && sender && (
              <div className="absolute left-12 top-0 z-50 pointer-events-none" ref={cardRef}>
                <MemberCard member={sender} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-medium text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1 w-full text-center leading-none select-none">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        {!isGrouped && (
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1.5 pr-10 sm:pr-0">
            <span
              className="max-w-[11rem] truncate text-[15px] font-semibold text-white/95 cursor-pointer hover:underline sm:max-w-none tracking-tight"
              onMouseEnter={() => setShowCard(true)}
              onMouseLeave={() => setShowCard(false)}
            >
              {sender?.name ?? "Unknown"}
            </span>
            {senderIsAdmin && (
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] bg-purple-500/20 text-purple-300 rounded-md px-1.5 py-0.5 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                Admin
              </span>
            )}
            {!senderIsAdmin && sender?.team_role === "leader" && (
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-yellow-400/90 flex items-center gap-0.5 bg-yellow-500/10 px-1.5 py-0.5 rounded-md border border-yellow-500/20">
                <Star className="w-2.5 h-2.5" />Lead
              </span>
            )}
            <span className="text-[11px] font-medium text-gray-500 ml-1">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {msg.is_pinned && (
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-yellow-500 flex items-center gap-1 ml-auto sm:ml-2">
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
          </div>
        )}

        {/* Text */}
        {msg.content && (
          <p className="whitespace-pre-wrap text-[15px] text-gray-200/95 leading-[1.6] break-words">
            {renderContent(msg.content)}
          </p>
        )}

        {/* Image */}
        {msg.file_url && msg.file_type === "image" && (
          <div className="mt-2.5 max-w-full sm:max-w-sm">
            <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
              <div className="relative rounded-xl overflow-hidden bg-black/40 border border-white/10 shadow-md hover:border-white/20 transition-colors" style={{ maxHeight: 320 }}>
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
            className="mt-2.5 inline-flex max-w-full items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all duration-200 shadow-sm group"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <FileText className="w-4 h-4 shrink-0" />
            </div>
            <span className="min-w-0 truncate max-w-[200px] font-medium">{msg.file_name ?? "File"}</span>
            {msg.file_size_bytes && (
              <span className="text-[11px] font-medium text-gray-500 shrink-0">
                {(msg.file_size_bytes / 1024).toFixed(0)}KB
              </span>
            )}
            <Download className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0 ml-1" />
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
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border",
                  r.mine
                    ? "bg-purple-500/20 border-purple-500/30 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                    : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200"
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
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl bg-black/80 p-1 opacity-100 backdrop-blur-xl border border-white/10 shadow-xl transition-all duration-200 sm:static sm:shrink-0 sm:bg-transparent sm:p-0 sm:opacity-0 sm:backdrop-blur-none sm:border-none sm:shadow-none sm:group-hover:opacity-100">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmoji && (
              <div className="absolute right-0 bottom-full mb-2 glass rounded-2xl p-2 border border-white/20 flex gap-1 z-50 shadow-2xl bg-black/80 backdrop-blur-3xl">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}
                    className="text-xl hover:scale-125 transition-transform w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-xl"
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
                "p-1.5 rounded-lg hover:bg-white/10 transition-colors",
                msg.is_pinned ? "text-yellow-500" : "text-gray-500 hover:text-white"
              )}
              title={msg.is_pinned ? "Unpin" : "Pin"}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
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
    if (channel.channel_type === "dm") {
      return getDirectChannelUserIds(channel.name).includes(userId);
    }
    return !channel.team_id || channel.team_id === myTeamId || isAdmin;
  }, [isAdmin, myTeamId, userId]);

  const getChannelLabel = useCallback((channel: HackathonChatChannel | undefined) => {
    if (!channel) return "";
    if (channel.channel_type === "spawn_point") return "Spawn Point";
    if (channel.channel_type !== "dm") return channel.name;

    const otherUserId = getDirectChannelUserIds(channel.name).find((id) => id !== userId);
    return otherUserId ? memberMap.get(otherUserId)?.name ?? "Direct message" : "Direct message";
  }, [memberMap, userId]);

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
    if (currentChannel.channel_type === "dm") {
      return getDirectChannelUserIds(currentChannel.name).includes(userId);
    }
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

  const openDirectMessage = async (targetUserId: string) => {
    if (targetUserId === userId) return;

    const result = await ensureDirectChannel(event.id, targetUserId);
    if (result.error || !result.channel) {
      toast.error(result.error ?? "Could not open DM");
      return;
    }

    setChannels((prev) =>
      prev.some((channel) => channel.id === result.channel!.id)
        ? prev
        : [...prev, result.channel!]
    );
    await switchChannel(result.channel.id);
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
    <div className="relative flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col overflow-hidden rounded-[22px] bg-black/40 backdrop-blur-3xl border border-white/10 animate-fade-in sm:h-[calc(100vh-12rem)] sm:rounded-[28px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-screen" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
      
      {/* Subtle top gradient light */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

      {/* Channel nav */}
      <div className="relative flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.02] px-2.5 pt-2.5 pb-2 shrink-0 sm:px-3 z-10">
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex w-max flex-nowrap gap-1.5 pr-1">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 border",
                  ch.id === resolvedChannelId
                    ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                    : "bg-transparent text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/5 hover:border-white/10"
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
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border",
              showMembers
                ? "bg-white/10 text-white border-white/20"
                : "bg-transparent text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/5 hover:border-white/10"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{members.length}</span>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Channel header */}
          <div className="relative flex items-center gap-2.5 border-b border-white/[0.05] bg-gradient-to-r from-white/[0.02] to-transparent px-4 py-3 shrink-0 z-10">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white/5 border border-white/10">
              <ChannelIcon type={currentChannel?.channel_type ?? "general"} className="text-gray-400 w-3 h-3" />
            </div>
            <span className="min-w-0 truncate text-[15px] font-semibold text-white/90 tracking-tight">{getChannelLabel(currentChannel)}</span>
            {currentChannel?.channel_type === "spawn_point" && (
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] text-yellow-400/80 bg-yellow-500/10 px-2 py-0.5 rounded-full ml-1">Unassigned</span>
            )}
            {currentChannel?.channel_type === "announcements" && (
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full ml-1">Admin Only</span>
            )}
            {currentChannel?.channel_type === "team" && (
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded-full ml-1">Private Team</span>
            )}
            {currentChannel?.channel_type === "dm" && (
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.2em] text-green-400/80 bg-green-500/10 px-2 py-0.5 rounded-full ml-1">Direct</span>
            )}
          </div>

          {/* Message list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-2 pb-4 space-y-0 scrollbar-hide"
          >
            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] font-medium uppercase tracking-[0.1em] text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 disabled:opacity-40 shadow-sm"
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
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 shadow-inner">
                  <ChannelIcon type={currentChannel?.channel_type ?? "general"} className="w-8 h-8 text-gray-500" />
                </div>
                {currentChannel?.channel_type === "spawn_point" ? (
                  <>
                    <p className="text-[15px] font-semibold text-gray-300">Welcome to Spawn Point</p>
                    <p className="text-[13px] text-gray-500 mt-1.5 max-w-[220px] leading-relaxed">Introduce yourself while you wait to be assigned to a team.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold text-gray-300">No messages yet</p>
                    <p className="text-[13px] text-gray-500 mt-1">Be the first to say something!</p>
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
                />
              )
            )}
            <div ref={messagesEndRef} className="h-6 shrink-0" />
          </div>

          {/* Input area */}
          <div className="px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0 sm:px-4 sm:pb-5 relative z-10">
            {/* Input top gradient fade */}
            <div className="absolute bottom-full left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            
            {channels.length > 1 && (
              <div className="mb-3 hidden items-center gap-2 overflow-x-auto scrollbar-hide sm:flex">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 px-1">
                  Channels
                </span>
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => switchChannel(ch.id)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 border",
                      ch.id === resolvedChannelId
                        ? "bg-white/10 text-white border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]"
                        : "bg-transparent text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5 hover:border-white/10"
                    )}
                  >
                    <ChannelIcon type={ch.channel_type} className={cn(
                      "w-3 h-3 transition-colors",
                      ch.id === resolvedChannelId ? "text-white" : "text-gray-500"
                    )} />
                    {getChannelLabel(ch)}
                  </button>
                ))}
              </div>
            )}
            {!canPost ? (
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-sm text-gray-400 shadow-inner">
                <AlertCircle className="w-4 h-4 text-gray-500" />
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
                  <div className="absolute bottom-full mb-3 left-0 right-0 glass rounded-2xl border border-white/10 overflow-hidden z-50 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-3xl bg-black/80">
                    {filteredMentions.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => insertMention(m)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left border-b border-white/[0.05] last:border-0 group"
                      >
                        <div className="ring-1 ring-white/10 rounded-xl shadow-sm">
                          <Avatar member={m} size="sm" />
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-gray-300 group-hover:text-white transition-colors">{m.name}</p>
                          {m.team && (
                            <p className="text-[11px] font-medium text-gray-500">{m.team.name}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-2xl border border-white/[0.15] bg-black/40 backdrop-blur-xl px-3 py-3 transition-all duration-300 focus-within:border-white/30 focus-within:bg-black/60 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.05)] sm:gap-3 sm:px-4 shadow-inner">
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
                          : currentChannel?.channel_type === "dm"
                            ? `Message ${getChannelLabel(currentChannel)}…`
                            : `Message #${currentChannel ? getChannelLabel(currentChannel) : "…"}`
                    }
                    rows={1}
                    className="min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-white placeholder-gray-500 focus:outline-none max-h-32 py-1"
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
                  <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
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
                      className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-40"
                      title="Attach file"
                    >
                      {uploadingFile ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!draft.trim() || isPending}
                      className="p-2 rounded-xl bg-white text-black hover:bg-gray-200 hover:scale-105 transition-all duration-200 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 ml-3 hidden text-[10px] font-medium text-gray-600 sm:block">
                  <span className="text-gray-500">Enter</span> to send · <span className="text-gray-500">Shift+Enter</span> for new line · <span className="text-gray-500">@name</span> to mention
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
          <div className="absolute inset-y-0 right-0 z-30 flex w-[min(18rem,86vw)] shrink-0 flex-col overflow-hidden border-l border-white/[0.08] bg-black/60 backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.5)] sm:relative sm:z-auto sm:w-60 sm:shadow-none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-white/[0.02] shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                Members — {members.length}
              </span>
              <button
                onClick={() => setShowMembers(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 scrollbar-hide px-2">
              {/* Admin / staff first */}
              {members.filter((m) => ["admin", "staff", "facilitator"].includes(m.role)).length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400/80 px-3 mb-2">Organizers</p>
                  {members
                    .filter((m) => ["admin", "staff", "facilitator"].includes(m.role))
                    .map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        canMessage={m.id !== userId}
                        onDirectMessage={() => openDirectMessage(m.id)}
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
                        <div className="w-4 h-4 rounded-md overflow-hidden relative shrink-0 ring-1 ring-white/10 shadow-sm">
                          <Image src={team.icon_photo.file_url} alt={team.name} fill className="object-cover" sizes="16px" />
                        </div>
                      ) : null}
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 truncate">
                        {team?.name ?? "Team"}
                      </p>
                    </div>
                    {teamMembers.map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        canMessage={m.id !== userId}
                        onDirectMessage={() => openDirectMessage(m.id)}
                      />
                    ))}
                  </div>
                );
              })}

              {/* No team */}
              {membersByTeam.noTeam.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600 px-3 mb-2">No Team</p>
                  {membersByTeam.noTeam
                    .filter((m) => !["admin", "staff", "facilitator"].includes(m.role))
                    .map((m) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        canMessage={m.id !== userId}
                        onDirectMessage={() => openDirectMessage(m.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Member row in sidebar ────────────────────────────────────────────────────

function MemberRow({
  member, canMessage, onDirectMessage,
}: {
  member: ChatMember;
  canMessage: boolean;
  onDirectMessage: () => void;
}) {
  const [showCard, setShowCard] = useState(false);

  return (
    <div
      className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all duration-200 cursor-default group"
      onMouseEnter={() => setShowCard(true)}
      onMouseLeave={() => setShowCard(false)}
    >
      <div className="ring-1 ring-white/10 rounded-xl shadow-sm">
        <Avatar member={member} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-gray-200 truncate group-hover:text-white transition-colors">{member.name}</p>
        {member.team_role === "leader" && (
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-yellow-500">Lead</span>
        )}
      </div>
      {(member.role === "admin" || member.role === "staff" || member.role === "facilitator") && (
        <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
      )}
      {canMessage && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDirectMessage();
          }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
          title={`DM ${member.name}`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {showCard && (
        <div className="absolute left-full top-0 ml-2 z-50 pointer-events-none">
          <MemberCard member={member} />
        </div>
      )}
    </div>
  );
}
