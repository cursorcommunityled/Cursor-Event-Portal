"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { votePoll } from "@/lib/actions/polls";
import { cn } from "@/lib/utils";
import { Check, Star } from "lucide-react";
import type { PollWithVotes } from "@/types";
import { RaceCar } from "@/components/polls/RaceCar";

interface Props {
  poll: PollWithVotes;
  eventSlug: string;
}

const EXPECTED_AUDIENCE_VOTES = 150;

export function AudienceVoteCard({ poll, eventSlug }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(poll.user_vote?.option_index ?? null);
  const [voteCounts, setVoteCounts] = useState(poll.vote_counts);
  const [totalVotes, setTotalVotes] = useState(poll.total_votes);
  const [loading, setLoading] = useState(false);
  const [celebrated, setCelebrated] = useState(!!poll.user_vote);

  const hasVoted = selected !== null;
  const showResults = poll.show_results;
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
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-red-400/30 bg-red-500/10 text-red-200 shadow-[0_0_30px_rgba(239,68,68,0.18)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.2),transparent_70%)]" />
            <Star className="relative h-9 w-9 fill-red-300/20" />
          </div>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.2)]">
                <Star className="w-3 h-3" /> Audience Award
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
                : showResults
                  ? `Voting closed · ${totalVotes} vote${totalVotes !== 1 ? "s" : ""} cast`
                  : "Voting closed · results will be shared by the host"}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {poll.options.map((option, idx) => {
            const isChosen = selected === idx;
            const isLeading = showResults && voteCounts[idx] === maxVotes && voteCounts[idx] > 0;
            const raceProgress = showResults
              ? Math.min((voteCounts[idx] / EXPECTED_AUDIENCE_VOTES) * 100, 100)
              : isChosen ? 100 : 0;
            const carIsMoving = hasVoted && (showResults ? voteCounts[idx] > 0 : isChosen);

            return (
              <button
                key={idx}
                onClick={() => handleVote(idx)}
                disabled={loading || !poll.is_active}
                className={cn(
                  "relative w-full overflow-hidden rounded-[20px] border p-0 text-left transition-all duration-300 group h-16 bg-[#1a1a1a]",
                  isChosen
                    ? "border-red-400/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    : "border-white/8 hover:border-red-500/30",
                  (!poll.is_active || loading) && "cursor-not-allowed"
                )}
              >
                {/* Track background */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-[#2a2a2a]" />

                {/* Track lines */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] border-t-2 border-dashed border-white/20" />
                {carIsMoving && (
                  <div
                    className="absolute left-[140px] top-[calc(50%+16px)] h-[3px] rounded-full opacity-60"
                    style={{
                      width: `calc((100% - 140px - 3rem) * ${raceProgress / 100})`,
                      background:
                        "repeating-linear-gradient(90deg, rgba(0,0,0,0.75) 0 12px, transparent 12px 22px)",
                    }}
                  />
                )}

                {/* Start line (Checkered) */}
                <div className="absolute left-[140px] top-0 bottom-0 w-4 flex flex-col flex-wrap opacity-80 z-0">
                  {[...Array(16)].map((_, i) => (
                    <div key={i} className={cn("w-2 h-2", (i + Math.floor(i/2)) % 2 === 0 ? "bg-white" : "bg-black")} />
                  ))}
                </div>

                {/* Finish line (Checkered) */}
                <div className="absolute right-4 top-0 bottom-0 w-4 flex flex-col flex-wrap opacity-80 z-0">
                  {[...Array(16)].map((_, i) => (
                    <div key={i} className={cn("w-2 h-2", (i + Math.floor(i/2)) % 2 === 0 ? "bg-white" : "bg-black")} />
                  ))}
                </div>

                {/* Option Info (Fixed on the left) */}
                <div className="absolute left-0 top-0 bottom-0 w-[140px] bg-black/90 backdrop-blur-md border-r border-white/10 flex flex-col justify-center px-4 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-1.5">
                    {isChosen && <Check className="w-3 h-3 text-red-400 shrink-0" />}
                    <span className={cn(
                      "text-[13px] font-bold truncate",
                      isChosen ? "text-white" : "text-gray-300"
                    )}>
                      {option}
                    </span>
                  </div>
                  {showResults && hasVoted && (
                    <span className={cn(
                      "text-[11px] font-black tabular-nums",
                      isChosen ? "text-red-300" : isLeading ? "text-yellow-400" : "text-gray-500"
                    )}>
                      {voteCounts[idx]} vote{voteCounts[idx] === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {/* The Car */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-10 flex items-center"
                  style={{ 
                    // Start at 140px, end at right-12 (calc(100% - 3rem))
                    left: `calc(140px + (100% - 140px - 3rem) * ${hasVoted ? raceProgress / 100 : 0})`
                  }}
                >
                  <RaceCar
                    isWinning={isLeading}
                    isMoving={carIsMoving}
                    variant={isChosen ? "red" : "white"}
                  />
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors z-30 pointer-events-none" />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">
            {showResults
              ? `${totalVotes} vote${totalVotes !== 1 ? "s" : ""} cast`
              : "Live results hidden"}
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
