"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Smile, Pin, Trash2, Pencil, Check, ImageIcon, FileText, Download, Star, Plus } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { cn } from "@/lib/utils";
import type { ChatMember } from "@/types";
import type { LocalHackathonChatMessage } from "./types";
import { Avatar } from "./Avatar";
import { MemberCard } from "./MemberCard";

const QUICK_EMOJIS = ["👍", "🔥", "🚀", "💡", "❤️", "😂", "🎉", "⚡"];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ChatMsg({
  msg, userId, isAdmin, members, memberMap, isGrouped, onReact, onDelete, onPin, onOpenProfile, onEdit,
}: {
  msg: LocalHackathonChatMessage;
  userId: string;
  isAdmin: boolean;
  members: ChatMember[];
  memberMap: Map<string, ChatMember>;
  isGrouped: boolean;
  onReact: (msgId: string, emoji: string) => void;
  onDelete: (msgId: string) => void;
  onPin: (msgId: string, pinned: boolean) => void;
  onOpenProfile: (member: ChatMember) => void;
  onEdit: (msgId: string, newContent: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFullEmoji, setShowFullEmoji] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content ?? "");
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const handleShowCard = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cardWidth = 256;
    const cardHeight = 240;

    let left = rect.right + 12;
    if (left + cardWidth > window.innerWidth - 16) {
      left = rect.left - cardWidth - 12;
    }

    let top = rect.top;
    if (top + cardHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - cardHeight - 16);
    }

    setCardPos({ top, left });
    setShowCard(true);
  };

  const sender = memberMap.get(msg.user_id);
  const isMine = msg.user_id === userId;
  const isPendingUpload = msg.upload_status === "uploading" || msg.upload_status === "posting";
  const canDelete = !isPendingUpload && (isMine || isAdmin);
  const canEdit = !isPendingUpload && isMine && msg.content;
  const canPin = !isPendingUpload && isAdmin;

  const senderIsAdmin =
    sender?.role === "admin" || sender?.role === "staff" || sender?.role === "facilitator";

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      // Move cursor to the end
      editInputRef.current.selectionStart = editInputRef.current.value.length;
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.style.height = "auto";
      editInputRef.current.style.height = `${editInputRef.current.scrollHeight}px`;
    }
  }, [editValue, isEditing]);

  const handleEditSubmit = () => {
    if (editValue.trim() !== msg.content) {
      onEdit(msg.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditValue(msg.content ?? "");
    setIsEditing(false);
  };

  // Group reactions by emoji
  const reactions = useMemo(() => {
    const map: Record<string, { emoji: string; count: number; mine: boolean; users: string[] }> = {};
    for (const r of msg.reactions ?? []) {
      if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, mine: false, users: [] };
      map[r.emoji].count++;
      if (r.user_id === userId) map[r.emoji].mine = true;
      const member = memberMap.get(r.user_id);
      if (member) {
        map[r.emoji].users.push(member.name);
      } else {
        map[r.emoji].users.push("Unknown");
      }
    }
    return Object.values(map);
  }, [msg.reactions, userId, memberMap]);

  const mentionRegex = useMemo(() => {
    const names = members
      .map((member) => member.name.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);

    if (names.length === 0) return null;
    return new RegExp(`@(${names.join("|")})(?=$|[\\s.,!?;:])`, "gi");
  }, [members]);

  // Render content with @mention highlighting
  const renderContent = (text: string) => {
    if (!mentionRegex) return text;

    const nodes: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(mentionRegex)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, index)}</span>);
      }
      nodes.push(
        <span key={`mention-${index}`} className="bg-white/20 text-gray-400 rounded-md px-1 py-0.5 font-medium border border-white/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
          {match[0]}
        </span>
      );
      lastIndex = index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return nodes;
  };

  return (
    <div
      id={`hackathon-chat-message-${msg.id}`}
      className={cn(
        "group relative flex gap-3 px-3 rounded-[24px] transition-all duration-300 sm:gap-4 sm:px-6 mx-2",
        isGrouped ? "py-1.5" : "pt-5 pb-2 mt-2",
        showActions && "bg-white/[0.04] shadow-inner",
        msg.is_pinned && "bg-yellow-500/[0.05] border border-yellow-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        !showActions && !msg.is_pinned && "hover:bg-white/[0.02]"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); setShowFullEmoji(false); }}
    >
      {/* Avatar column */}
      <div className="w-10 shrink-0 flex flex-col items-center">
        {!isGrouped ? (
          <button
            type="button"
            className="relative cursor-pointer mt-0.5"
            onMouseEnter={handleShowCard}
            onMouseLeave={() => setShowCard(false)}
            onClick={() => sender && onOpenProfile(sender)}
          >
            <div className="ring-1 ring-white/15 rounded-2xl shadow-lg">
              <Avatar member={sender ?? null} size="sm" />
            </div>
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
              onMouseEnter={handleShowCard}
              onMouseLeave={() => setShowCard(false)}
              onClick={() => sender && onOpenProfile(sender)}
            >
              {sender?.name ?? "Unknown"}
            </span>
            {senderIsAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-white/20 text-gray-400 rounded-md px-1.5 py-0.5 border border-white/25 shadow-[0_0_10px_rgba(239,68,68,0.15)]">
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
        {msg.content && !isEditing && (
          <p className="whitespace-pre-wrap text-[16px] text-gray-100 leading-[1.65] break-words">
            {renderContent(msg.content)}
            {msg.updated_at && msg.updated_at !== msg.created_at && (
              <span className="text-[11px] text-gray-500 ml-2 font-medium italic">(edited)</span>
            )}
          </p>
        )}

        {isEditing && (
          <div className="mt-1 flex flex-col gap-2">
            <textarea
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleEditCancel();
                }
              }}
              className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-[15px] text-white focus:outline-none focus:border-white/50 resize-none"
              rows={Math.max(1, editValue.split("\n").length)}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditCancel}
                className="px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={!editValue.trim() || editValue.trim() === msg.content}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider bg-white/20 text-gray-400 border border-white/30 hover:bg-white/30 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              <span className="text-gray-400">Enter</span> to save · <span className="text-gray-400">Shift+Enter</span> for new line · <span className="text-gray-400">Esc</span> to cancel
            </p>
          </div>
        )}

        {/* Pending upload */}
        {isPendingUpload && (
          <div
            className="mt-2.5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-[15px] text-gray-100 shadow-sm"
            aria-live="polite"
          >
            <div className="rounded-lg bg-white/10 p-2 text-gray-400">
              {msg.file_type === "image" ? (
                <ImageIcon className="h-4 w-4 shrink-0" />
              ) : (
                <FileText className="h-4 w-4 shrink-0" />
              )}
            </div>
            <div className="min-w-0">
              <p className="max-w-[220px] truncate font-medium">{msg.file_name ?? "Attachment"}</p>
              <p className="text-[12px] font-medium text-gray-400">
                {msg.upload_status === "uploading" ? "Uploading..." : "Posting..."}
              </p>
            </div>
            {msg.file_size_bytes && (
              <span className="shrink-0 text-[12px] font-medium text-gray-500">
                {(msg.file_size_bytes / 1024).toFixed(0)}KB
              </span>
            )}
            <div className="ml-1 h-4 w-4 shrink-0 rounded-full border-2 border-white/20 border-t-white/90 animate-spin" />
          </div>
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
            <div className="p-2 rounded-lg bg-white/10 text-gray-400 group-hover:bg-white/20 transition-colors">
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
                title={r.users.join(", ")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-all duration-200 border",
                  r.mine
                    ? "bg-white/20 border-white/30 text-gray-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
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
      {showActions && !isPendingUpload && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-2xl bg-black/85 p-1 opacity-100 backdrop-blur-xl border border-white/15 shadow-xl transition-all duration-200 sm:static sm:shrink-0 sm:bg-transparent sm:p-0 sm:opacity-0 sm:backdrop-blur-none sm:border-none sm:shadow-none sm:group-hover:opacity-100">
          <div className="relative">
            <button
              onClick={() => {
                setShowEmoji(!showEmoji);
                if (showEmoji) setShowFullEmoji(false);
              }}
              className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmoji && !showFullEmoji && (
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
                <button
                  onClick={() => setShowFullEmoji(true)}
                  className="text-xl hover:scale-125 transition-transform w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl text-gray-400 hover:text-white"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
            {showFullEmoji && (
              <div className="absolute right-0 bottom-full mb-2 z-50 shadow-2xl">
                <EmojiPicker
                  theme={Theme.DARK}
                  onEmojiClick={(emojiData) => {
                    onReact(msg.id, emojiData.emoji);
                    setShowFullEmoji(false);
                    setShowEmoji(false);
                  }}
                  autoFocusSearch={false}
                />
              </div>
            )}
          </div>
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
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
              className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-gray-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {showCard && sender && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed z-[100] pointer-events-none" 
          style={{ top: cardPos.top, left: cardPos.left }}
        >
          <MemberCard member={sender} />
        </div>,
        document.body
      )}
    </div>
  );
}