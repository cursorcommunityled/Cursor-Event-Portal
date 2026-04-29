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
          const percentage =
            totalVotes > 0 ? Math.round((voteCounts[index] / totalVotes) * 100) : 0;
          const isWinning = voteCounts[index] === maxVotes && voteCounts[index] > 0;

          return (
            <button
              key={index}
              onClick={() => handleVote(index)}
              disabled={loading || isEnded}
              className={cn(
                "w-full relative rounded-2xl p-4 text-left transition-all duration-300 overflow-hidden group",
                isSelected
                  ? "bg-white/10 border-2 border-white/30"
                  : "bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04]",
                (loading || isEnded) && "cursor-not-allowed opacity-70"
              )}
            >
              {/* Progress bar background */}
              {showResults && (
                <div
                  className={cn(
                    "absolute inset-0 transition-all duration-500 ease-out",
                    isWinning ? "bg-white/10" : "bg-white/[0.03]"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "text-sm font-light leading-relaxed whitespace-normal break-words",
                      isSelected ? "text-white" : "text-gray-300"
                    )}
                  >
                    {option}
                  </span>
                </div>

                {showResults && (
                  <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
                    <span className="text-xs text-gray-500 tabular-nums">
                      {voteCounts[index]}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums w-12 text-right",
                        isWinning ? "text-white" : "text-gray-500"
                      )}
                    >
                      {percentage}%
                    </span>
                  </div>
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
