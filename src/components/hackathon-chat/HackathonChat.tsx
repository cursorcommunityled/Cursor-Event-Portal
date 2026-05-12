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
import { cn } from "@/lib/utils";
import {
  Hash, Lock, Megaphone, BookOpen, Users, X, Send,
  Paperclip, Smile, Pin, Trash2, ChevronUp, Shield,
  Star, ImageIcon, FileText, Download, AlertCircle, MessageCircle,
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
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const font = size === "sm" ? "text-xs" : "text-sm";
  const iconDim = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  const photo = member?.team?.icon_photo;
  if (photo?.status === "approved" && photo.file_url) {
    return (
      <div className={cn(dim, "rounded-xl overflow-hidden shrink-0 relative")}>
        <Image src={photo.file_url} alt={member!.team!.name} fill className="object-cover" sizes="40px" />
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
      className={cn(dim, "rounded-xl shrink-0 flex items-center justify-center text-white font-medium", font)}
      style={{ background: `hsl(${hue}, 50%, 30%)` }}
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
    <div className="glass rounded-2xl p-4 border border-white/20 w-56 space-y-3 shadow-2xl z-50">
      <div className="flex items-center gap-3">
        <Avatar member={member} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{member.name}</p>
          {member.role === "admin" || member.role === "staff" || member.role === "facilitator" ? (
            <span className="text-[9px] uppercase tracking-[0.18em] text-purple-400 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Admin
            </span>
          ) : member.team_role === "leader" ? (
            <span className="text-[9px] uppercase tracking-[0.18em] text-yellow-400 flex items-center gap-1">
              <Star className="w-2.5 h-2.5" /> Team Lead
            </span>
          ) : null}
        </div>
      </div>
      {member.team && (
        <div className="border-t border-white/10 pt-3 flex items-center gap-2">
          <Avatar member={member} size="sm" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Team</p>
            <p className="text-xs text-white truncate">{member.team.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Channel icon helper ──────────────────────────────────────────────────────

function ChannelIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("w-3.5 h-3.5", className);
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
            <span key={i} className="bg-purple-500/20 text-purple-300 rounded px-0.5">
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
        "group flex gap-3 px-4 rounded-xl transition-colors duration-150",
        isGrouped ? "py-1.5" : "pt-4 pb-1.5",
        showActions && "bg-white/5",
        msg.is_pinned && "bg-yellow-400/5 border-l-2 border-yellow-400/40 pl-3",
        "hover:bg-white/[0.03]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); }}
    >
      {/* Avatar column */}
      <div className="w-8 shrink-0 flex flex-col items-center">
        {!isGrouped ? (
          <div
            className="relative cursor-pointer"
            onMouseEnter={() => setShowCard(true)}
            onMouseLeave={() => setShowCard(false)}
          >
            <Avatar member={sender ?? null} size="sm" />
            {showCard && sender && (
              <div className="absolute left-10 top-0 z-50 pointer-events-none" ref={cardRef}>
                <MemberCard member={sender} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 w-full text-center leading-none select-none">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className="text-sm font-semibold text-white cursor-pointer hover:underline"
              onMouseEnter={() => setShowCard(true)}
              onMouseLeave={() => setShowCard(false)}
            >
              {sender?.name ?? "Unknown"}
            </span>
            {senderIsAdmin && (
              <span className="text-[9px] uppercase tracking-[0.18em] bg-purple-500/20 text-purple-400 rounded px-1.5 py-0.5">
                Admin
              </span>
            )}
            {!senderIsAdmin && sender?.team_role === "leader" && (
              <span className="text-[9px] text-yellow-400 flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5" />Lead
              </span>
            )}
            <span className="text-[10px] text-gray-600 ml-1">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {msg.is_pinned && (
              <span className="text-[9px] uppercase tracking-[0.15em] text-yellow-400 flex items-center gap-1">
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
          </div>
        )}

        {/* Text */}
        {msg.content && (
          <p className="whitespace-pre-wrap text-sm text-gray-100 leading-relaxed break-words">
            {renderContent(msg.content)}
          </p>
        )}

        {/* Image */}
        {msg.file_url && msg.file_type === "image" && (
          <div className="mt-2 max-w-sm">
            <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
              <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10" style={{ maxHeight: 320 }}>
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
            className="mt-2 inline-flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate max-w-[200px]">{msg.file_name ?? "File"}</span>
            {msg.file_size_bytes && (
              <span className="text-xs text-gray-500 shrink-0">
                {(msg.file_size_bytes / 1024).toFixed(0)}KB
              </span>
            )}
            <Download className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          </a>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(msg.id, r.emoji)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all",
                  r.mine
                    ? "bg-purple-500/20 border-purple-500/40 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
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
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity relative">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmoji && (
              <div className="absolute right-0 bottom-8 glass rounded-xl p-2 border border-white/20 flex gap-1 z-50">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}
                    className="text-lg hover:scale-125 transition-transform w-7 h-7 flex items-center justify-center"
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
                msg.is_pinned ? "text-yellow-400" : "text-gray-500 hover:text-white"
              )}
              title={msg.is_pinned ? "Unpin" : "Pin"}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
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
    if (currentChannel.team_id) {
      const myMember = memberMap.get(userId);
      return isAdmin || myMember?.team?.id === currentChannel.team_id;
    }
    // general / resources — all signed-in attendees can post
    return true;
  }, [currentChannel, channels.length, isAdmin, memberMap, userId]);

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
    <div className="flex flex-col h-[calc(100vh-12rem)] rounded-[28px] overflow-hidden glass border border-white/10 animate-fade-in">

      {/* Channel nav */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-b border-white/10 overflow-x-auto scrollbar-hide shrink-0">
        <div className="flex gap-1.5 flex-nowrap">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => switchChannel(ch.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200",
                ch.id === resolvedChannelId
                  ? "bg-white text-black shadow-glow"
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              )}
            >
              <ChannelIcon type={ch.channel_type} className={ch.id === resolvedChannelId ? "text-black" : undefined} />
              {getChannelLabel(ch)}
            </button>
          ))}
        </div>
        <div className="ml-auto shrink-0">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all",
              showMembers
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{members.length}</span>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Messages */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Channel header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 shrink-0">
            <ChannelIcon type={currentChannel?.channel_type ?? "general"} className="text-gray-500" />
            <span className="text-sm font-medium text-white/80">{getChannelLabel(currentChannel)}</span>
            {currentChannel?.channel_type === "announcements" && (
              <span className="text-[9px] uppercase tracking-[0.15em] text-gray-600">· admin only</span>
            )}
            {currentChannel?.channel_type === "team" && (
              <span className="text-[9px] uppercase tracking-[0.15em] text-gray-600">· private</span>
            )}
            {currentChannel?.channel_type === "dm" && (
              <span className="text-[9px] uppercase tracking-[0.15em] text-gray-600">· direct</span>
            )}
          </div>

          {/* Message list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-2 space-y-0 scrollbar-hide"
          >
            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
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
                <ChannelIcon type={currentChannel?.channel_type ?? "general"} className="w-8 h-8 text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">No messages yet</p>
                <p className="text-[11px] text-gray-700 mt-1">Be the first to say something!</p>
              </div>
            )}

            {groupedMessages.map(({ msg, isGrouped }) => (
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
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 pb-3 shrink-0">
            {channels.length > 1 && (
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                <span className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-gray-700 px-1">
                  Channels
                </span>
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => switchChannel(ch.id)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                      ch.id === resolvedChannelId
                        ? "bg-white text-black"
                        : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <ChannelIcon type={ch.channel_type} className={ch.id === resolvedChannelId ? "text-black" : undefined} />
                    {getChannelLabel(ch)}
                  </button>
                ))}
              </div>
            )}
            {!canPost ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/3 border border-white/10 text-xs text-gray-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {currentChannel?.channel_type === "announcements"
                  ? "Only admins can post in announcements"
                  : channels.length === 0
                    ? "Chat channels not set up — run the SQL migration in Supabase"
                    : "Only team members can post in this channel"}
              </div>
            ) : (
              <div className="relative">
                {showMentionPicker && filteredMentions.length > 0 && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 glass rounded-2xl border border-white/20 overflow-hidden z-50">
                    {filteredMentions.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => insertMention(m)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <Avatar member={m} size="sm" />
                        <div>
                          <p className="text-sm text-white">{m.name}</p>
                          {m.team && (
                            <p className="text-[10px] text-gray-600">{m.team.name}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 focus-within:border-white/25 transition-colors">
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
                        : currentChannel?.channel_type === "dm"
                          ? `Message ${getChannelLabel(currentChannel)}…`
                          : `Message #${currentChannel ? getChannelLabel(currentChannel) : "…"}`
                    }
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none resize-none max-h-32 leading-relaxed"
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
                  <div className="flex items-center gap-1 shrink-0">
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
                      className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40"
                      title="Attach file"
                    >
                      {uploadingFile ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!draft.trim() || isPending}
                      className="p-1.5 rounded-lg bg-white text-black hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-gray-700 mt-1 ml-2">
                  Enter to send · Shift+Enter for new line · @name to mention
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Members sidebar */}
        {showMembers && (
          <div className="w-52 border-l border-white/10 flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                Members — {members.length}
              </span>
              <button
                onClick={() => setShowMembers(false)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
              {/* Admin / staff first */}
              {members.filter((m) => ["admin", "staff", "facilitator"].includes(m.role)).length > 0 && (
                <div className="mb-2">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-purple-400/70 px-3 mb-1">Organizers</p>
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
                  <div key={teamId} className="mb-2">
                    <div className="flex items-center gap-1.5 px-3 mb-1">
                      {team?.icon_photo?.status === "approved" ? (
                        <div className="w-3.5 h-3.5 rounded overflow-hidden relative shrink-0">
                          <Image src={team.icon_photo.file_url} alt={team.name} fill className="object-cover" sizes="14px" />
                        </div>
                      ) : null}
                      <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 truncate">
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
                <div className="mb-2">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-700 px-3 mb-1">No Team</p>
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
      className="relative flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors cursor-default"
      onMouseEnter={() => setShowCard(true)}
      onMouseLeave={() => setShowCard(false)}
    >
      <Avatar member={member} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-300 truncate">{member.name}</p>
        {member.team_role === "leader" && (
          <span className="text-[9px] text-yellow-400">Lead</span>
        )}
      </div>
      {(member.role === "admin" || member.role === "staff" || member.role === "facilitator") && (
        <Shield className="w-3 h-3 text-purple-400 shrink-0" />
      )}
      {canMessage && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDirectMessage();
          }}
          className="p-1 rounded-md text-gray-600 hover:text-white hover:bg-white/10 transition-colors"
          title={`DM ${member.name}`}
        >
          <MessageCircle className="w-3 h-3" />
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
