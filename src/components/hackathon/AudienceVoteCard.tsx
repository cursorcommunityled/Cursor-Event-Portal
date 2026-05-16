"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { votePoll } from "@/lib/actions/polls";
import { cn } from "@/lib/utils";
import { Check, Trophy } from "lucide-react";
import type { PollWithVotes } from "@/types";

interface Props {
  poll: PollWithVotes;
  eventSlug: string;
}

export function AudienceVoteCard({ poll, eventSlug }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(poll.user_vote?.option_index ?? null);
  const [voteCounts, setVoteCounts] = useState(poll.vote_counts);
  const [totalVotes, setTotalVotes] = useState(poll.total_votes);
  const [loading, setLoading] = useState(false);
  const [celebrated, setCelebrated] = useState(!!poll.user_vote);

  const hasVoted = selected !== null;
  const maxVotes = Math.max(...voteCounts, 1);

  const handleVote = async (idx: number) => {
    if (loading || !poll.is_active) return;

    const prev = { selected, voteCounts: [...voteCounts], totalVotes };
    const removing = hasVoted && selected === idx;

    // Optimistic update
    const next = [...voteCounts];
    if (removing) {
      next[idx] = Math.max(0, next[idx] - 1);
      setTotalVotes((t) => Math.max(0, t - 1));
      setSelected(null);
      setCelebrated(false);
    } else {
      if (selected !== null) next[selected] = Math.max(0, next[selected] - 1);
      else setTotalVotes((t) => t + 1);
      next[idx]++;
      setSelected(idx);
      setCelebrated(true);
    }
    setVoteCounts(next);
    setLoading(true);

    const res = await votePoll(poll.id, idx, eventSlug);
    if (res.error) {
      setSelected(prev.selected);
      setVoteCounts(prev.voteCounts);
      setTotalVotes(prev.totalVotes);
      setCelebrated(false);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="relative overflow-hidden rounded-[40px] border border-red-500/30 bg-black/60 backdrop-blur-2xl shadow-2xl">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.18)_0,transparent_65%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

      {/* Celebration sparkles */}
      {celebrated && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 rounded-full animate-ping"
              style={{
                left: `${10 + (i * 7.5) % 80}%`,
                top: `${15 + (i * 11) % 60}%`,
                animationDelay: `${i * 120}ms`,
                animationDuration: "1.2s",
                backgroundColor: i % 3 === 0 ? "#ef4444" : i % 3 === 1 ? "#f59e0b" : "#ffffff",
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative p-8 sm:p-10 space-y-7">
        {/* Header */}
        <div className="flex items-start gap-5">
          <div className="relative shrink-0 w-20 h-20 rounded-[20px] overflow-hidden border border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_30px_rgba(234,179,8,0.25)]">
            <Image src="/trophy.jpeg" alt="Trophy" fill className="object-cover" sizes="80px" />
          </div>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.2)]">
                <Trophy className="w-3 h-3" /> $250 Cash Prize
              </span>
              {poll.is_active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  Voting Open
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-gray-600/40 bg-gray-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Voting Closed
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Audience Favourite
            </h2>
            <p className="mt-1 text-[14px] font-medium text-gray-400">
              {poll.is_active
                ? "One vote per attendee — choose the project you loved most."
                : `Voting closed · ${totalVotes} vote${totalVotes !== 1 ? "s" : ""} cast`}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {poll.options.map((option, idx) => {
            const isChosen = selected === idx;
            const pct = totalVotes > 0 ? Math.round((voteCounts[idx] / totalVotes) * 100) : 0;
            const isLeading = voteCounts[idx] === maxVotes && voteCounts[idx] > 0;

            return (
              <button
                key={idx}
                onClick={() => handleVote(idx)}
                disabled={loading || !poll.is_active}
                className={cn(
                  "relative w-full overflow-hidden rounded-[20px] border p-5 text-left transition-all duration-300 group",
                  isChosen
                    ? "border-red-400/60 bg-red-500/15 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    : "border-white/8 bg-white/[0.025] hover:border-red-500/30 hover:bg-red-500/8",
                  (!poll.is_active || loading) && "cursor-not-allowed"
                )}
              >
                {/* Vote bar fill */}
                {hasVoted && (
                  <div
                    className={cn(
                      "absolute inset-0 transition-all duration-700 ease-out rounded-[20px]",
                      isLeading
                        ? isChosen ? "bg-red-500/20" : "bg-white/5"
                        : "bg-white/[0.02]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}

                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkmark / number */}
                    <div className={cn(
                      "shrink-0 flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-black transition-all",
                      isChosen
                        ? "border-red-400/60 bg-red-500/30 text-red-200"
                        : "border-white/10 bg-white/5 text-gray-500 group-hover:border-red-500/30 group-hover:text-red-300"
                    )}>
                      {isChosen ? <Check className="w-4 h-4" /> : <span>{idx + 1}</span>}
                    </div>
                    <p className={cn(
                      "text-[16px] font-bold tracking-tight truncate",
                      isChosen ? "text-white" : "text-gray-200"
                    )}>
                      {option}
                    </p>
                  </div>

                  {hasVoted && (
                    <div className="shrink-0 flex items-center gap-2">
                      {isLeading && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400">
                          Leading
                        </span>
                      )}
                      <span className={cn(
                        "text-[20px] font-black tabular-nums",
                        isChosen ? "text-red-300" : isLeading ? "text-yellow-400" : "text-gray-500"
                      )}>
                        {pct}%
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
          </p>
          {celebrated && (
            <p className="text-[12px] font-bold text-red-400 animate-pulse">
              Vote recorded ✓
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
