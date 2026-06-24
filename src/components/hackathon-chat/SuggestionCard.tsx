"use client";

import { useState } from "react";
import { Zap, UserPlus } from "lucide-react";
import { sendTeamInvite } from "@/lib/actions/hackathon";
import type { LocalHackathonChatMessage } from "./types";

export function SuggestionCard({
  msg, eventId, myTeamId,
}: {
  msg: LocalHackathonChatMessage;
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
      <div className="relative overflow-hidden rounded-[28px] border border-white/40 bg-white/10 px-5 py-5 shadow-neon">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-[40px]" />
        
        <div className="relative flex items-start gap-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 border border-white/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <Zap className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-1.5">Match Suggestion</p>
            <p className="text-[15px] font-medium text-gray-200 leading-relaxed">{msg.content}</p>

            {status === "sent" ? (
              <p className="mt-3 text-[13px] font-bold text-green-400">Invite sent to {suggestedName}!</p>
            ) : status === "error" ? (
              <p className="mt-3 text-[13px] font-bold text-gray-400">Could not send invite — they may already be on a team.</p>
            ) : showNameInput && !myTeamId ? (
              <div className="mt-4 flex items-center gap-2">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name…"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-medium text-white placeholder:text-gray-500 focus:outline-none focus:border-white/50 focus:bg-black/60"
                />
                <button
                  disabled={!teamName.trim() || status === "pending"}
                  onClick={() => handleInvite(teamName.trim())}
                  className="px-5 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wider bg-white/20 border border-white/30 text-gray-400 hover:bg-white/30 hover:border-white/50 transition-all disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2">
                <button
                  disabled={status === "pending"}
                  onClick={handleYes}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wider bg-white/20 border border-white/30 text-gray-400 hover:bg-white/30 hover:border-white/50 transition-all disabled:opacity-40"
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