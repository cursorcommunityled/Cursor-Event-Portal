"use client";

import { useMemo } from "react";
import { Pin } from "lucide-react";
import type { ChatMember } from "@/types";
import type { LocalHackathonChatMessage } from "./types";

export function PinnedMessagesPanel({
  messages, loading, memberMap, onJump,
}: {
  messages: LocalHackathonChatMessage[];
  loading: boolean;
  memberMap: Map<string, ChatMember>;
  onJump: (messageId: string) => void;
}) {
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [messages]
  );

  return (
    <div className="shrink-0 border-b border-yellow-500/20 bg-yellow-500/[0.055] px-4 py-3 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-yellow-400/25 bg-yellow-500/15 text-yellow-200">
            <Pin className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-200">Pinned Messages</p>
            <p className="text-[11px] font-medium text-gray-500">Important notes for this channel</p>
          </div>
        </div>
        {loading && (
          <div className="h-4 w-4 rounded-full border-2 border-yellow-200/20 border-t-yellow-200 animate-spin" />
        )}
      </div>

      {!loading && sortedMessages.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[13px] font-medium text-gray-500">
          No pinned messages in this channel yet.
        </div>
      ) : (
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1 scrollbar-hide">
          {sortedMessages.map((msg) => {
            const sender = memberMap.get(msg.user_id);
            const preview = msg.content?.trim()
              || msg.file_name
              || (msg.file_type === "image" ? "Pinned image" : "Pinned attachment");

            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => onJump(msg.id)}
                className="w-full rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3 text-left transition-colors hover:border-yellow-400/25 hover:bg-yellow-500/10"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-[12px] font-bold text-gray-200">{sender?.name ?? "Unknown"}</span>
                  <span className="shrink-0 text-[10px] font-medium text-gray-500">
                    {new Date(msg.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="max-h-10 overflow-hidden text-[13px] font-medium leading-snug text-gray-400">
                  {preview}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
