"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { votePoll } from "@/lib/actions/polls";
import { cn } from "@/lib/utils";
import { Check, Clock, Users } from "lucide-react";
import type { PollWithVotes } from "@/types";

interface PollCardProps {
  poll: PollWithVotes;
  eventSlug: string;
}

const EXPECTED_AUDIENCE_VOTES = 150;

function formatTimeRemaining(endsAt: string): string {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function PollCard({ poll, eventSlug }: PollCardProps) {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<number | null>(
    poll.user_vote?.option_index ?? null
  );
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(!!poll.user_vote);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(
    poll.ends_at ? formatTimeRemaining(poll.ends_at) : null
  );
  const [isEnded, setIsEnded] = useState(
    poll.ends_at ? new Date(poll.ends_at) < new Date() : false
  );
  const [voteCounts, setVoteCounts] = useState(poll.vote_counts);
  const [totalVotes, setTotalVotes] = useState(poll.total_votes);

  // Countdown timer and auto-refresh when poll expires
  useEffect(() => {
    if (!poll.ends_at) return;

    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(poll.ends_at!);
      setTimeRemaining(remaining);

      if (remaining === "Ended") {
        setIsEnded(true);
        clearInterval(interval);
        // Refresh the page after a short delay to update poll status
        setTimeout(() => {
          router.refresh();
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [poll.ends_at, router]);

  const handleVote = async (optionIndex: number) => {
    if (loading || isEnded) return;

    const previousVoteCounts = voteCounts;
    const previousTotalVotes = totalVotes;
    const previousSelectedOption = selectedOption;
    const previousHasVoted = hasVoted;
    const isRemovingVote = hasVoted && selectedOption === optionIndex;

    setLoading(true);

    // Optimistic update
    const newVoteCounts = [...voteCounts];
    if (isRemovingVote) {
      newVoteCounts[optionIndex] = Math.max(0, newVoteCounts[optionIndex] - 1);
      setTotalVotes((prev) => Math.max(0, prev - 1));
      setSelectedOption(null);
      setHasVoted(false);
    } else if (hasVoted && selectedOption !== null) {
      newVoteCounts[selectedOption] = Math.max(0, newVoteCounts[selectedOption] - 1);
      newVoteCounts[optionIndex]++;
      setSelectedOption(optionIndex);
      setHasVoted(true);
    } else {
      setTotalVotes((prev) => prev + 1);
      newVoteCounts[optionIndex]++;
      setSelectedOption(optionIndex);
      setHasVoted(true);
    }
    setVoteCounts(newVoteCounts);

    const result = await votePoll(poll.id, optionIndex, eventSlug);

    if (result.error) {
      // Revert optimistic update
      setVoteCounts(previousVoteCounts);
      setTotalVotes(previousTotalVotes);
      setSelectedOption(previousSelectedOption);
      setHasVoted(previousHasVoted);
    } else {
      // Refresh to get updated vote counts
      router.refresh();
    }

    setLoading(false);
  };

  const showResults = hasVoted || isEnded || poll.show_results;
  const maxVotes = Math.max(...voteCounts, 1);

  return (
    <div className="glass rounded-[32px] p-8 space-y-6 relative overflow-hidden">
      {/* Live indicator */}
      {!isEnded && (
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
          <span className="text-[9px] uppercase tracking-[0.2em] text-green-400/80 font-medium">
            Live
          </span>
        </div>
      )}

      {/* Timer */}
      {poll.ends_at && !isEnded && (
        <div className="flex items-center gap-2 text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-[0.15em]">
            {timeRemaining} remaining
          </span>
        </div>
      )}

      {isEnded && (
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-[0.15em]">
            Poll ended
          </span>
        </div>
      )}

      {/* Question */}
      <h3 className="text-xl font-light text-white tracking-tight pr-16">
        {poll.question}
      </h3>

      {/* Options */}
      <div className="space-y-3">
        {poll.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isWinning = voteCounts[index] === maxVotes && voteCounts[index] > 0;
          const raceProgress = showResults
            ? Math.min((voteCounts[index] / EXPECTED_AUDIENCE_VOTES) * 100, 100)
            : 0;

          return (
            <button
              key={index}
              onClick={() => handleVote(index)}
              disabled={loading || isEnded}
              className={cn(
                "w-full relative h-20 rounded-2xl text-left transition-all duration-300 overflow-hidden group border",
                isSelected
                  ? "border-white/35 bg-white/[0.06] shadow-[0_0_18px_rgba(255,255,255,0.08)]"
                  : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                (loading || isEnded) && "cursor-not-allowed opacity-70"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/80 via-zinc-950/90 to-zinc-800/80" />
              <div className="absolute left-32 right-8 top-1/2 border-t-2 border-dashed border-white/15" />
              <div className="absolute left-32 top-0 bottom-0 w-3 bg-[linear-gradient(45deg,#fff_25%,#111_25%,#111_50%,#fff_50%,#fff_75%,#111_75%,#111_100%)] bg-[length:12px_12px] opacity-80" />
              <div className="absolute right-5 top-0 bottom-0 w-3 bg-[linear-gradient(45deg,#fff_25%,#111_25%,#111_50%,#fff_50%,#fff_75%,#111_75%,#111_100%)] bg-[length:12px_12px] opacity-80" />

              <div className="absolute inset-y-0 left-0 z-20 flex w-32 flex-col justify-center border-r border-white/10 bg-black/80 px-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {isSelected ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-black" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] font-medium text-gray-500">
                      {index + 1}
                    </span>
                  )}
                  <span className={cn(
                    "truncate text-sm font-medium",
                    isSelected ? "text-white" : "text-gray-300"
                  )}>
                    {option}
                  </span>
                </div>

                {showResults && (
                  <span className={cn(
                    "mt-1 text-[11px] font-medium tabular-nums",
                    isWinning ? "text-yellow-300" : "text-gray-500"
                  )}>
                    {voteCounts[index]} vote{voteCounts[index] === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div
                className="absolute top-1/2 z-10 flex -translate-y-1/2 items-center transition-all duration-700 ease-out"
                style={{
                  left: `calc(8rem + (100% - 11.5rem) * ${raceProgress / 100})`,
                }}
              >
                {showResults && voteCounts[index] > 0 && (
                  <span className="absolute right-full h-4 w-10 rounded-full bg-gradient-to-l from-white/20 to-transparent blur-sm" />
                )}
                <span className="inline-block text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                  🏎️
                </span>
                {isWinning && showResults && voteCounts[index] > 0 && (
                  <span className="absolute -right-2 -top-2 animate-pulse text-lg">🔥</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Vote count */}
      <div className="flex items-center gap-2 text-gray-600 pt-2">
        <Users className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-[0.15em]">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </span>
      </div>
    </div>
  );
}
