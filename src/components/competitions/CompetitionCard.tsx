"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, ChevronDown, ChevronUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntryCard } from "./EntryCard";
import { SubmitEntryModal } from "./SubmitEntryModal";
import type { CompetitionWithEntries } from "@/types";

/** Minimal winner celebration overlay (no external Confetti module). */
function WinnerCelebration({ duration = 20000 }: { duration?: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);
  if (!visible) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/10 to-transparent animate-pulse" />
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-yellow-400/80 animate-ping"
          style={{
            left: `${10 + (i * 8)}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

interface CompetitionCardProps {
  competition: CompetitionWithEntries;
  eventSlug: string;
  userId: string;
  isAdmin?: boolean;
}

const statusLabels: Record<string, string> = {
  active: "Accepting Submissions",
  voting: "Voting Open",
  ended: "Ended",
};

const statusColors: Record<string, string> = {
  active: "text-green-400",
  voting: "text-blue-400",
  ended: "text-gray-500",
};

export function CompetitionCard({ competition, eventSlug, userId, isAdmin = false }: CompetitionCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevWinnerRef = useRef<string | null>(null);

  const isTop3 = competition.voting_mode === "top3";
  const top3Ids = competition.top3_entry_ids || [];

  const userHasEntry = competition.entries?.some((e) => e.user_id === userId);
  const canSubmit = competition.status === "active" && !userHasEntry;
  const canVote = competition.status === "voting";

  const isInitialMount = useRef(true);

  // Detect when any winner is newly announced (supports both single and dual winner modes)
  const anyWinnerId = isTop3
    ? competition.group_winner_entry_id || competition.admin_winner_entry_id
    : competition.winner_entry_id;

  useEffect(() => {
    const currentWinnerId = anyWinnerId;
    const previousWinnerId = prevWinnerRef.current;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevWinnerRef.current = currentWinnerId ?? null;
      return;
    }

    if (currentWinnerId && !previousWinnerId) {
      setShowCelebration(true);
      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 20000);
      return () => clearTimeout(timer);
    }

    prevWinnerRef.current = currentWinnerId ?? null;
  }, [anyWinnerId]);

  return (
    <div className="glass rounded-[32px] border border-white/10 min-w-0 overflow-visible relative">
      {showCelebration && <WinnerCelebration duration={20000} />}

      {/* ── top3 mode: dual winner banners ── */}
      {isTop3 && (competition.group_winner_entry || competition.admin_winner_entry) && (
        <div className="rounded-t-[32px] overflow-hidden">
          {competition.group_winner_entry && (
            <div className={cn(
              "bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border-b border-blue-500/20 px-8 py-3 flex items-center gap-3",
              showCelebration && "animate-pulse"
            )}>
              <Users className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-sm text-blue-300 font-medium">
                People&apos;s Choice: {competition.group_winner_entry.title}
                {competition.group_winner_entry.user && (
                  <span className="text-blue-400/60 ml-1">
                    by {competition.group_winner_entry.user.name}
                  </span>
                )}
              </span>
            </div>
          )}
          {competition.admin_winner_entry && (
            <div className={cn(
              "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-b border-yellow-500/20 px-8 py-3 flex items-center gap-3",
              showCelebration && "animate-pulse"
            )}>
              <Trophy className={cn("w-4 h-4 text-yellow-400 shrink-0", showCelebration && "animate-bounce")} />
              <span className="text-sm text-yellow-300 font-medium">
                Admin Pick: {competition.admin_winner_entry.title}
                {competition.admin_winner_entry.user && (
                  <span className="text-yellow-400/60 ml-1">
                    by {competition.admin_winner_entry.user.name}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── standard mode: single winner banner ── */}
      {!isTop3 && competition.winner_entry && (
        <div className={cn(
          "bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-b border-yellow-500/20 px-8 py-4 flex items-center gap-3 rounded-t-[32px]",
          showCelebration && "animate-pulse ring-2 ring-yellow-400/50 ring-offset-2 ring-offset-transparent"
        )}>
          <Trophy className={cn("w-5 h-5 text-yellow-400", showCelebration && "animate-bounce")} />
          <span className="text-sm text-yellow-300 font-medium">
            Winner: {competition.winner_entry.title}
            {competition.winner_entry.user && (
              <span className="text-yellow-400/60 ml-1">
                by {competition.winner_entry.user.name}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-8 py-6 flex items-center justify-between text-left"
      >
        <div className="space-y-1">
          <h2 className="text-xl font-light text-white tracking-tight">
            {competition.title}
          </h2>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={cn("text-[10px] uppercase tracking-[0.2em] font-medium", statusColors[competition.status])}>
              {statusLabels[competition.status]}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
              {competition.entries?.length || 0} entries
            </span>
            {isTop3 && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-purple-500 font-medium">
                Top 3 — Dual Prizes
              </span>
            )}
            {!isTop3 && competition.voting_mode !== "group" && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-medium">
                {competition.voting_mode} voting
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-8 pb-8 space-y-6">
          {competition.description && (
            <p className="text-sm text-gray-400 leading-relaxed">
              {competition.description}
            </p>
          )}

          {competition.rules && (
            <div className="bg-white/5 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">
                Rules
              </p>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                {competition.rules}
              </p>
            </div>
          )}

          {/* top3 info banner during voting — finalists confirmed */}
          {isTop3 && competition.status === "voting" && top3Ids.length === 3 && (
            <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 px-5 py-4">
              <p className="text-xs text-purple-300 font-medium mb-1">3 Finalists Selected</p>
              <p className="text-xs text-gray-400">
                Vote for your favorite finalist below. Two prizes will be awarded: a People&apos;s Choice (group votes) and an Admin Pick.
              </p>
            </div>
          )}

          {/* top3 info banner during voting — finalists not yet confirmed */}
          {isTop3 && competition.status === "voting" && top3Ids.length < 3 && (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4">
              <p className="text-xs text-white font-medium mb-1">Finalists Being Selected</p>
              <p className="text-xs text-gray-400">
                The organiser is reviewing all submissions and will announce 3 finalists shortly. Voting opens once they&apos;re confirmed.
              </p>
            </div>
          )}

          {/* Submit button */}
          {canSubmit && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3 rounded-2xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all"
            >
              Submit Your Project
            </button>
          )}

          {/* Voting open but no entries */}
          {canVote && (!competition.entries || competition.entries.length === 0) && (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-6 text-center">
              <p className="text-sm text-gray-400">
                Voting is open, but there are no submissions yet.
              </p>
            </div>
          )}

          {/* Ended with no entries */}
          {competition.status === "ended" && (!competition.entries || competition.entries.length === 0) && (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-6 text-center">
              <p className="text-sm text-gray-400">
                This competition ended with no submissions.
              </p>
            </div>
          )}

          {/* Entries list */}
          {competition.entries && competition.entries.length > 0 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                {isTop3 && canVote && top3Ids.length === 3 ? "Finalists" : "Submissions"}
              </p>
              {competition.entries.map((entry) => {
                const isFinalist = top3Ids.includes(entry.id);
                // In top3 mode during voting: only show the 3 confirmed finalists (admins see all)
                // When finalists not yet confirmed: show all entries (no vote buttons) so people can browse
                const top3Locked = isTop3 && top3Ids.length === 3;
                const showEntry = !isTop3 || !top3Locked || isFinalist || competition.status !== "voting" || isAdmin;
                if (!showEntry) return null;

                  return (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    competitionId={competition.id}
                    eventId={competition.event_id}
                    eventSlug={eventSlug}
                    userId={userId}
                    canVote={canVote && (!isTop3 || (top3Locked && isFinalist))}
                    votingMode={competition.voting_mode}
                    isWinner={entry.id === competition.winner_entry_id}
                    isGroupWinner={entry.id === competition.group_winner_entry_id}
                    isAdminWinner={entry.id === competition.admin_winner_entry_id}
                    isFinalist={isTop3 && isFinalist}
                    isAdmin={isAdmin}
                    competitionStatus={competition.status}
                  />
                );
              })}

              {/* Show non-finalist entries collapsed during voting in top3 mode (only when finalists are locked) */}
              {isTop3 && canVote && top3Ids.length === 3 && competition.entries.some((e) => !top3Ids.includes(e.id)) && (
                <p className="text-xs text-gray-600 text-center pt-2">
                  Other submissions are hidden during voting — only the 3 finalists are eligible.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showSubmitModal && (
        <SubmitEntryModal
          competitionId={competition.id}
          eventId={competition.event_id}
          eventSlug={eventSlug}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}
