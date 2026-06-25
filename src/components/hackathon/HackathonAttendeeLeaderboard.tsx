"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HACKATHON_SCORE_MAX } from "@/lib/hackathon-rubric";
import type { HackathonTeamWithMembers } from "@/types";
import { TeamIcon } from "@/components/hackathon/TeamIcon";
import {
  AIScreeningScoreAssessment,
  type AIScreeningScoreDetail,
} from "@/components/hackathon/AIScreeningScoreAssessment";
import { ChevronDown, Trophy } from "lucide-react";

export type AttendeeLeaderboardEntry = {
  team: HackathonTeamWithMembers;
  score: number;
  source: "judge" | "ai";
  assessment?: AIScreeningScoreDetail;
};

interface Props {
  entries: AttendeeLeaderboardEntry[];
  myTeamId?: string | null;
  sourceLabel: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function HackathonAttendeeLeaderboard({ entries, myTeamId, sourceLabel }: Props) {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-lg">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
        <div className="relative space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10">
            <Trophy className="h-8 w-8 text-yellow-400/80" />
          </div>
          <p className="text-xl font-bold tracking-tight text-white">AI screening scores coming soon</p>
          <p className="text-[14px] font-medium text-gray-500">
            Rankings appear here after AI analysis completes. Final-round judge scores are announced separately.
          </p>
        </div>
      </div>
    );
  }

  const maxScore = entries[0]?.source === "ai" ? 100 : HACKATHON_SCORE_MAX;

  const toggleExpanded = (teamId: string) => {
    setExpandedTeamId((current) => (current === teamId ? null : teamId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">{sourceLabel}</p>
        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-green-300">
          Live
        </span>
      </div>

      <div className="space-y-3">
        {entries.map(({ team, score, source, assessment }, index) => {
          const isMine = team.id === myTeamId;
          const isTop3 = index < 3;
          const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
          const isExpanded = expandedTeamId === team.id;
          const canExpand = source === "ai" && !!assessment;

          return (
            <div
              key={team.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all",
                isMine ? "border-white/30 bg-white/[0.06] ring-1 ring-white/20" :
                isTop3 ? "border-yellow-500/25 bg-yellow-500/[0.03]" :
                "border-white/10 bg-black/40",
                isExpanded && "ring-1 ring-white/15"
              )}
            >
              <button
                type="button"
                disabled={!canExpand}
                onClick={() => canExpand && toggleExpanded(team.id)}
                className={cn(
                  "relative w-full p-5 text-left transition-colors",
                  canExpand && "cursor-pointer hover:bg-white/[0.02]",
                  !canExpand && "cursor-default"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                    {isTop3 ? (
                      <span className="text-2xl">{MEDALS[index]}</span>
                    ) : (
                      <span className="text-xl font-black tabular-nums text-gray-500">{index + 1}</span>
                    )}
                  </div>

                  <TeamIcon
                    photo={team.icon_photo}
                    name={team.name}
                    className="h-12 w-12 rounded-xl border-white/10 bg-white/5"
                    fallbackClassName="opacity-20"
                    sizes="48px"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-bold text-white">{team.name}</h3>
                      {isMine && (
                        <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          You
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] font-medium text-gray-500">
                      {team.project?.name ?? team.members.map((m) => m.user?.name).filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          index === 0 ? "bg-gradient-to-r from-yellow-500 to-yellow-300" : "bg-white/70"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-3xl font-black tabular-nums text-white">{score}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        / {maxScore}{source === "ai" ? "" : " pts"}
                      </p>
                    </div>

                    {canExpand && (
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition-all duration-300",
                          isExpanded && "border-white/25 bg-white/10"
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-transform duration-300",
                            isExpanded && "rotate-180 text-white"
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {canExpand && assessment && (
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-white/10 bg-black/20 px-5 pb-5 pt-4">
                      <AIScreeningScoreAssessment assessment={assessment} variant="full" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {entries.some((entry) => entry.source === "ai" && entry.assessment) && (
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
          Tap a team to view full score assessment
        </p>
      )}
    </div>
  );
}
