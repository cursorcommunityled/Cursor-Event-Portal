"use client";

import {
  useState, useEffect, useRef, useCallback, useTransition, useMemo,
} from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import {
  sendChatMessage, deleteChatMessage, pinChatMessage, editChatMessage,
  toggleChatReaction, markChannelRead, loadMoreMessages, fetchChannelMessages, fetchPinnedMessages,
} from "@/lib/actions/hackathon-chat";
import { sendTeamInvite } from "@/lib/actions/hackathon";
import { cn } from "@/lib/utils";
import {
  Hash, Lock, Megaphone, BookOpen, Users, X, Send,
  Paperclip, Smile, Pin, Trash2, ChevronUp, Shield,
  Star, ImageIcon, FileText, Download, AlertCircle, Zap, UserPlus,
  Linkedin, Pencil, Check, Search,
} from "lucide-react";
import { getTeamRecommendations, type TeamRecommendation } from "@/lib/actions/hackathon-profiles";
import type {
  HackathonChatChannel, HackathonChatMessage, HackathonChatReaction,
  ChatMember, Event,
} from "@/types";

import type { LocalHackathonChatMessage } from "./types";
import { MemberProfileModal } from "./MemberProfileModal";
import { SuggestionCard } from "./SuggestionCard";
import { TeamFinderPanel } from "./TeamFinderPanel";
import { ChannelIcon } from "./ChannelIcon";
import { ChatMsg } from "./ChatMsg";
import { MemberRow } from "./MemberRow";
import { PinnedMessagesPanel } from "./PinnedMessagesPanel";
import { Avatar } from "./Avatar";

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

// ─── Main HackathonChat component ─────────────────────────────────────────────

export function HackathonChat({
  event, userId, isAdmin, channels: initialChannels,
  initialMessages, initialChannelId, members, myTeamId,
}: Props) {
  const [channels, setChannels] = useState(initialChannels);
  const [activeChannelId, setActiveChannelId] = useState(initialChannelId);
  const [messageMap, setMessageMap] = useState<Record<string, LocalHackathonChatMessage[]>>({
    [initialChannelId]: initialMessages,
  });
  const [pinnedMessageMap, setPinnedMessageMap] = useState<Record<string, LocalHackathonChatMessage[]>>({
    [initialChannelId]: initialMessages.filter((message) => message.is_pinned),
  });
  const [showPinned, setShowPinned] = useState(false);
  const [loadingPinned, setLoadingPinned] = useState(false);
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 60);
  const [showMembers, setShowMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
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

  const [typingState, setTypingState] = useState<Record<string, Set<string>>>({});
  const typingBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingClearTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // If active channel is missing (e.g. empty initialChannelId), fall back to first channel
  const resolvedChannelId = activeChannelId || channels[0]?.id || "";
  const currentChannel = channels.find((c) => c.id === resolvedChannelId);
  const messages = messageMap[resolvedChannelId] ?? [];
  const pinnedMessages = pinnedMessageMap[resolvedChannelId] ?? messages.filter((message) => message.is_pinned);

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

  const visibleSidebarMembers = useMemo(() => {
    const query = memberSearchQuery.trim().toLowerCase();
    if (!query) return members;

    return members.filter((member) => {
      const searchable = [
        member.name,
        member.role,
        member.team?.name,
        member.team_role,
        member.occupation,
        member.unique_skill,
        member.profile_bio,
        member.project_interests,
        member.collaboration_style,
        member.looking_for_teammates,
        member.is_technical === null || member.is_technical === undefined
          ? null
          : member.is_technical
            ? "technical"
            : "non technical",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [memberSearchQuery, members]);

  // Group members by team for the sidebar
  const membersByTeam = useMemo(() => {
    const withTeam: ChatMember[] = [];
    const noTeam: ChatMember[] = [];
    const teamOrder: string[] = [];
    const grouped: Record<string, ChatMember[]> = {};

    for (const m of visibleSidebarMembers) {
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
  }, [visibleSidebarMembers]);

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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [draft]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`hackathon-chat-${event.id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId: typistId, channelId: typingChannelId } = payload.payload;
        if (typistId === userId) return;

        setTypingState((prev) => {
          const channelSet = new Set(prev[typingChannelId] || []);
          channelSet.add(typistId);
          return { ...prev, [typingChannelId]: channelSet };
        });

        const key = `${typingChannelId}-${typistId}`;
        if (typingClearTimeoutsRef.current[key]) {
          clearTimeout(typingClearTimeoutsRef.current[key]);
        }
        typingClearTimeoutsRef.current[key] = setTimeout(() => {
          setTypingState((prev) => {
            const channelSet = new Set(prev[typingChannelId] || []);
            channelSet.delete(typistId);
            return { ...prev, [typingChannelId]: channelSet };
          });
        }, 3000);
      })
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
          if (newMsg.is_pinned) {
            setPinnedMessageMap((prev) => {
              const existing = prev[newMsg.channel_id] ?? [];
              if (existing.some((m) => m.id === newMsg.id)) return prev;
              return { ...prev, [newMsg.channel_id]: [...existing, newMsg] };
            });
          }
          if (newMsg.channel_id === activeChannelId && isNearBottom()) {
            requestAnimationFrame(() => scrollToBottom(true));
          }
          if (newMsg.channel_id !== activeChannelId && newMsg.user_id !== userId) {
            setChannels((prev) => prev.map((ch) =>
              ch.id === newMsg.channel_id ? { ...ch, unread_count: (ch.unread_count || 0) + 1 } : ch
            ));
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
          setPinnedMessageMap((prev) => {
            const existing = prev[updated.channel_id] ?? [];
            if (updated.deleted_at || !updated.is_pinned) {
              return { ...prev, [updated.channel_id]: existing.filter((m) => m.id !== updated.id) };
            }
            const next = existing.some((m) => m.id === updated.id)
              ? existing.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
              : [...existing, updated];
            return { ...prev, [updated.channel_id]: next };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hackathon_chat_reactions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const reaction = payload.new as HackathonChatReaction;
            setMessageMap((prev) => {
              const updated = { ...prev };
              for (const channelId of Object.keys(updated)) {
                const idx = updated[channelId].findIndex((m) => m.id === reaction.message_id);
                if (idx === -1) continue;
                const existing = updated[channelId][idx].reactions ?? [];
                if (existing.some((r) => r.id === reaction.id)) break;
                const withoutOptimistic = existing.filter(
                  (r) => !(r.emoji === reaction.emoji && r.user_id === reaction.user_id && r.id.startsWith("opt-"))
                );
                updated[channelId] = updated[channelId].map((m, i) =>
                  i === idx ? { ...m, reactions: [...withoutOptimistic, reaction] } : m
                );
                break;
              }
              return updated;
            });
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<HackathonChatReaction>;
            if (!old.id) return;
            setMessageMap((prev) => {
              const updated = { ...prev };
              for (const channelId of Object.keys(updated)) {
                const idx = updated[channelId].findIndex((m) => m.reactions?.some((r) => r.id === old.id));
                if (idx === -1) continue;
                updated[channelId] = updated[channelId].map((m, i) =>
                  i === idx ? { ...m, reactions: (m.reactions ?? []).filter((r) => r.id !== old.id) } : m
                );
                break;
              }
              return updated;
            });
          }
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

    realtimeChannelRef.current = channel;

    return () => { 
      supabase.removeChannel(channel); 
      realtimeChannelRef.current = null;
    };
  }, [event.id, activeChannelId, canSeeChannel, isNearBottom, scrollToBottom, userId]);

  // Scroll to bottom on initial load
  useEffect(() => {
    scrollToBottom();
  }, [activeChannelId, scrollToBottom]);

  // Mark channel as read when switching to it
  useEffect(() => {
    if (resolvedChannelId) {
      markChannelRead(resolvedChannelId).catch(() => {});
      setChannels((prev) => prev.map((ch) =>
        ch.id === resolvedChannelId && ch.unread_count ? { ...ch, unread_count: 0 } : ch
      ));
    }
  }, [resolvedChannelId]);

  useEffect(() => {
    if (!resolvedChannelId) return;

    let cancelled = false;
    setLoadingPinned(true);
    fetchPinnedMessages(resolvedChannelId)
      .then((pinned) => {
        if (cancelled) return;
        setPinnedMessageMap((prev) => ({ ...prev, [resolvedChannelId]: pinned }));
      })
      .finally(() => {
        if (!cancelled) setLoadingPinned(false);
      });

    return () => {
      cancelled = true;
    };
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
    const channelId = resolvedChannelId;
    const draftBeforeUpload = draft;
    const caption = draftBeforeUpload.trim();
    const optimisticId = `upload-${Date.now()}`;
    const optimisticFileType: "image" | "file" = file.type.startsWith("image/") ? "image" : "file";
    const currentUser = memberMap.get(userId);
    const now = new Date().toISOString();
    const optimistic: LocalHackathonChatMessage = {
      id: optimisticId,
      channel_id: channelId,
      event_id: event.id,
      user_id: userId,
      content: caption || null,
      file_url: null,
      file_type: optimisticFileType,
      file_name: file.name,
      file_size_bytes: file.size,
      is_pinned: false,
      mentioned_user_ids: [],
      deleted_at: null,
      created_at: now,
      updated_at: now,
      is_system_message: false,
      suggestion_user_id: null,
      user: currentUser ? { id: userId, name: currentUser.name } : undefined,
      reactions: [],
      upload_status: "uploading",
    };

    const removeOptimisticUpload = () => {
      setMessageMap((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).filter((m) => m.id !== optimisticId),
      }));
    };

    const restoreDraftIfUntouched = () => {
      setDraft((prev) => (prev ? prev : draftBeforeUpload));
    };

    setMessageMap((prev) => ({
      ...prev,
      [channelId]: [...(prev[channelId] ?? []), optimistic],
    }));
    setDraft("");
    setUploadingFile(true);
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("eventId", event.id);
      fd.append("channelId", channelId);
      const res = await fetch("/api/hackathon/chat-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        removeOptimisticUpload();
        restoreDraftIfUntouched();
        toast.error(data.error ?? "Upload failed");
        return;
      }

      setMessageMap((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).map((m) =>
          m.id === optimisticId ? { ...m, upload_status: "posting" } : m
        ),
      }));

      startTransition(async () => {
        try {
          const result = await sendChatMessage(
            channelId, event.id,
            caption || null, [],
            data.file_url, data.file_type, data.file_name, data.file_size_bytes
          );
          if (result.error) {
            removeOptimisticUpload();
            restoreDraftIfUntouched();
            toast.error(result.error);
            return;
          }
          if (result.message) {
            setMessageMap((prev) => {
              const existing = prev[channelId] ?? [];
              const postedMessage = { ...result.message!, reactions: result.message!.reactions ?? [] };
              const withoutOptimistic = existing.filter((m) => m.id !== optimisticId);
              if (withoutOptimistic.some((m) => m.id === postedMessage.id)) {
                return { ...prev, [channelId]: withoutOptimistic };
              }
              return {
                ...prev,
                [channelId]: [...withoutOptimistic, postedMessage],
              };
            });
            requestAnimationFrame(() => scrollToBottom(true));
          }
        } catch (err) {
          removeOptimisticUpload();
          restoreDraftIfUntouched();
          toast.error(err instanceof Error ? err.message : "Upload failed");
        }
      });
    } catch (err) {
      removeOptimisticUpload();
      restoreDraftIfUntouched();
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

  const handleEdit = (msgId: string, newContent: string) => {
    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).map((m) =>
        m.id === msgId ? { ...m, content: newContent, updated_at: new Date().toISOString() } : m
      ),
    }));
    setPinnedMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).map((m) =>
        m.id === msgId ? { ...m, content: newContent, updated_at: new Date().toISOString() } : m
      ),
    }));
    startTransition(async () => {
      const res = await editChatMessage(msgId, newContent);
      if (res.error) toast.error(res.error);
    });
  };

  const handleDelete = (msgId: string) => {
    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).filter((m) => m.id !== msgId),
    }));
    setPinnedMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).filter((m) => m.id !== msgId),
    }));
    startTransition(async () => { await deleteChatMessage(msgId); });
  };

  const handlePin = (msgId: string, pinned: boolean) => {
    const target = messages.find((message) => message.id === msgId);
    setMessageMap((prev) => ({
      ...prev,
      [resolvedChannelId]: (prev[resolvedChannelId] ?? []).map((m) =>
        m.id === msgId ? { ...m, is_pinned: pinned } : m
      ),
    }));
    setPinnedMessageMap((prev) => {
      const existing = prev[resolvedChannelId] ?? [];
      if (!pinned) {
        return { ...prev, [resolvedChannelId]: existing.filter((m) => m.id !== msgId) };
      }
      if (!target) return prev;
      const pinnedTarget = { ...target, is_pinned: true };
      const next = existing.some((m) => m.id === msgId)
        ? existing.map((m) => (m.id === msgId ? pinnedTarget : m))
        : [...existing, pinnedTarget];
      return { ...prev, [resolvedChannelId]: next };
    });
    startTransition(async () => { await pinChatMessage(msgId, pinned); });
  };

  const handlePinnedJump = (messageId: string) => {
    const element = document.getElementById(`hackathon-chat-message-${messageId}`);
    if (!element) {
      toast("Pinned message is older. Load older messages to jump to it.");
      return;
    }

    setShowPinned(false);
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // Textarea auto-grow + mention detection
  const handleDraftChange = (v: string, pos: number) => {
    setDraft(v);
    setCursorPos(pos);

    // Broadcast typing indicator — throttled to once per 2s
    if (v.trim() && realtimeChannelRef.current && !typingBroadcastTimeoutRef.current) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, channelId: resolvedChannelId },
      });
      typingBroadcastTimeoutRef.current = setTimeout(() => {
        typingBroadcastTimeoutRef.current = null;
      }, 2000);
    }

    // Detect @mention trigger
    const before = v.slice(0, pos);
    const match = before.match(/@([^@\n]*)$/);
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
    const prefix = before.replace(/@[^@\n]*$/, `@${member.name} `);
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
                {(ch.unread_count && ch.unread_count > 0 && ch.id !== resolvedChannelId) ? (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full leading-none shrink-0 font-bold min-w-[1.25rem] text-center flex items-center justify-center">
                    {ch.unread_count > 99 ? "99+" : ch.unread_count}
                  </span>
                ) : null}
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
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPinned((open) => !open)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-all",
                  showPinned
                    ? "border-yellow-400/30 bg-yellow-500/15 text-yellow-100"
                    : "border-white/[0.08] bg-white/[0.035] text-gray-400 hover:border-yellow-400/25 hover:text-yellow-100"
                )}
              >
                <Pin className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pins</span>
                {pinnedMessages.length > 0 && (
                  <span className="rounded-full bg-yellow-300 px-1.5 py-0.5 text-[10px] leading-none text-black">
                    {pinnedMessages.length > 99 ? "99+" : pinnedMessages.length}
                  </span>
                )}
              </button>
              <span className="hidden text-[12px] font-bold uppercase tracking-wider text-gray-500 sm:inline">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {showPinned && (
            <PinnedMessagesPanel
              messages={pinnedMessages}
              loading={loadingPinned}
              memberMap={memberMap}
              onJump={handlePinnedJump}
            />
          )}

          {currentChannel?.channel_type === "spawn_point" && !myTeamId && (
            <TeamFinderPanel
              eventId={event.id}
              userId={userId}
              myTeamId={myTeamId}
              members={members}
              onOpenProfile={setProfileMember}
            />
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
                    <p className="text-[15px] font-medium text-gray-400 mt-2 max-w-[320px] leading-relaxed">
                      Introduce yourself, or type <span className="font-bold text-gray-200">help</span> if you need an admin to jump in.
                    </p>
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
                  onEdit={handleEdit}
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
            
            {/* Typing Indicator */}
            {typingState[resolvedChannelId]?.size > 0 && (
              <div className="absolute bottom-full mb-1 left-6 right-6 text-[12px] text-gray-400 font-medium italic animate-pulse">
                {Array.from(typingState[resolvedChannelId])
                  .map((id) => memberMap.get(id)?.name || "Someone")
                  .join(", ")}{" "}
                {typingState[resolvedChannelId].size === 1 ? "is" : "are"} typing...
              </div>
            )}
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
                          ? `Introduce yourself or type help…`
                          : `Message #${currentChannel ? getChannelLabel(currentChannel) : "…"}`
                    }
                    rows={1}
                    className="min-w-0 flex-1 resize-none bg-transparent text-[16px] font-medium leading-relaxed text-white placeholder-gray-500 focus:outline-none max-h-32 py-1"
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
                Members — {memberSearchQuery.trim() ? `${visibleSidebarMembers.length}/${members.length}` : members.length}
              </span>
              <button
                onClick={() => setShowMembers(false)}
                className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="border-b border-white/[0.08] px-3 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search members"
                  className="h-10 w-full rounded-2xl border border-white/10 bg-black/35 pl-9 pr-8 text-[13px] font-medium text-white placeholder:text-gray-600 focus:border-white/25 focus:outline-none"
                />
                {memberSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMemberSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Clear member search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-4 scrollbar-hide px-2.5">
              {visibleSidebarMembers.length === 0 && (
                <div className="px-3 py-10 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">No matching members</p>
                </div>
              )}
              {/* Admin / staff first */}
              {visibleSidebarMembers.filter((m) => ["admin", "staff", "facilitator"].includes(m.role)).length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-200 px-3 mb-2">Organizers</p>
                  {visibleSidebarMembers
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

