"use client";

import { cn } from "@/lib/utils";
import {
  HACKATHON_SCORE_CATEGORIES,
  HACKATHON_SCORE_MAX,
  calculateAverageHackathonWeightedScore,
} from "@/lib/hackathon-rubric";
import type { HackathonScore } from "@/types";

interface Props {
  scores: HackathonScore[];
  className?: string;
}

export function JudgeScoreAssessment({ scores, className }: Props) {
  const total = calculateAverageHackathonWeightedScore(scores);

  const avg = (key: typeof HACKATHON_SCORE_CATEGORIES[number]["key"]) => {
    const vals = scores.map((s) => s[key]).filter((v) => v != null) as number[];
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">
            Judge scores
          </p>
          <p className="mt-1 text-[11px] font-medium text-gray-400">
            {scores.length} judge{scores.length !== 1 ? "s" : ""} · averaged
          </p>
        </div>
        <span className="text-3xl font-black tabular-nums text-white">
          {total}
          <span className="text-sm font-bold text-gray-500">/{HACKATHON_SCORE_MAX}</span>
        </span>
      </div>

      <div className="space-y-2">
        {HACKATHON_SCORE_CATEGORIES.map((category) => {
          const value = avg(category.key);
          const pct = value == null ? 0 : (value / 10) * 100;

          return (
            <div
              key={category.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-gray-200">
                      {category.label}
                    </span>
                    <span className="text-[10px] font-bold text-gray-600">{category.weight}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-white to-gray-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-[15px] font-black tabular-nums text-white">
                  {value ?? "—"}
                  <span className="text-[10px] font-bold text-gray-500">/10</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
