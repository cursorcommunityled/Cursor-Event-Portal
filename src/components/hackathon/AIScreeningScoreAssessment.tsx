"use client";

import { cn } from "@/lib/utils";
import {
  HACKATHON_SCORE_CATEGORIES,
  HACKATHON_SCORE_MAX,
  calculateHackathonWeightedScore,
} from "@/lib/hackathon-rubric";
import { Award, Lightbulb, Sparkles } from "lucide-react";

export type AIScreeningScoreDetail = {
  team_id: string;
  overall_score: number;
  criteria_scores: {
    criteria_key: string;
    score: number;
    reasoning?: string;
    confidence?: "low" | "medium" | "high" | string;
  }[];
  most_impressive_aspect?: string;
  recommended_award_categories?: string[];
  judge_briefing_points?: string[];
  concerns_and_limitations?: string[];
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "border-green-500/30 bg-green-500/10 text-green-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  low: "border-white/10 bg-white/5 text-gray-400",
};

function barColor(score: number) {
  if (score >= 8) return "bg-gradient-to-r from-green-500 to-emerald-400";
  if (score >= 6) return "bg-gradient-to-r from-white to-gray-300";
  if (score >= 4) return "bg-gradient-to-r from-yellow-500 to-amber-400";
  return "bg-gradient-to-r from-red-500 to-orange-400";
}

interface Props {
  assessment: AIScreeningScoreDetail;
  variant?: "compact" | "full";
  className?: string;
}

export function AIScreeningScoreAssessment({
  assessment,
  variant = "full",
  className,
}: Props) {
  const criteriaValues = Object.fromEntries(
    assessment.criteria_scores.map((c) => [c.criteria_key, c.score])
  );
  const weightedPoints = calculateHackathonWeightedScore(criteriaValues);
  const weightedOnTen = weightedPoints / 10;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">
            Cursor AI Judge
          </p>
          <p className="mt-1 text-[11px] font-medium text-gray-400">
            Weighted from 6 screening criteria
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black tabular-nums tracking-tight text-white">
            {weightedOnTen.toFixed(1)}
            <span className="text-sm font-bold text-gray-500">/10</span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">·</span>
          <span className="text-2xl font-black tabular-nums text-gray-300">
            {weightedPoints}
            <span className="text-[11px] font-bold text-gray-600">/{HACKATHON_SCORE_MAX}</span>
          </span>
        </div>
      </div>

      <div className={cn("space-y-3", variant === "compact" && "space-y-2")}>
        {HACKATHON_SCORE_CATEGORIES.map((category) => {
          const criterion = assessment.criteria_scores.find(
            (row) => row.criteria_key === category.key
          );
          const value = criterion?.score ?? null;
          const pct = value == null ? 0 : (value / 10) * 100;
          const confidence = criterion?.confidence?.toLowerCase() ?? "";

          return (
            <div
              key={category.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold text-gray-200">
                      {category.label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      {category.weight}%
                    </span>
                    {confidence && (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low
                        )}
                      >
                        {confidence}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", barColor(value ?? 0))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-right text-[15px] font-black tabular-nums text-white">
                  {value == null ? "—" : value.toFixed(1)}
                  <span className="text-[10px] font-bold text-gray-500">/10</span>
                </span>
              </div>
              {variant === "full" && criterion?.reasoning && (
                <p className="mt-2.5 text-[12px] leading-relaxed text-gray-400">
                  {criterion.reasoning}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {assessment.most_impressive_aspect && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300/90">
              Standout
            </p>
          </div>
          <p className="text-[13px] font-medium leading-relaxed text-gray-200">
            {assessment.most_impressive_aspect}
          </p>
        </div>
      )}

      {!!assessment.recommended_award_categories?.length && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Award className="h-3.5 w-3.5 text-white/60" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Recommended awards
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {assessment.recommended_award_categories.map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {variant === "full" && !!assessment.judge_briefing_points?.length && (
        <div className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-gray-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Judge notes
            </p>
          </div>
          <ul className="space-y-1.5">
            {assessment.judge_briefing_points.map((point) => (
              <li
                key={point}
                className="flex gap-2 text-[12px] leading-relaxed text-gray-400"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                <span>{point.replace(/^[·•]\s*/, "")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {variant === "full" && !!assessment.concerns_and_limitations?.length && (
        <div className="rounded-xl border border-white/5 px-4 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
            Limitations noted
          </p>
          <ul className="space-y-1">
            {assessment.concerns_and_limitations.slice(0, 3).map((concern) => (
              <li key={concern} className="text-[11px] leading-relaxed text-gray-500">
                {concern}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
