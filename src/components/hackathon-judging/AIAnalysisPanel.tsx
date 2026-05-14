"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { triggerAnalysis, applyAIScores } from "@/lib/actions/hackathon-analysis";
import {
  Cpu, ChevronDown, ChevronUp, Check, AlertCircle, Loader2,
  Sparkles, Star, TrendingUp, Eye, Users, MessageSquare, Lightbulb,
} from "lucide-react";
import type { HackathonAIAnalysis } from "@/lib/hackathon-analysis/types";
import type { Pass6Result } from "@/lib/hackathon-analysis/types";

const PASS_LABELS: Record<string, string> = {
  pass1_repo: "Repo Archaeology",
  pass2_code: "Code Deep-Dive",
  pass3_innovation: "Innovation Audit",
  pass4_visual: "Visual / UX",
  pass5_pool: "Pool Comparison",
  pass6_synthesis: "Synthesis",
};

const CRITERIA_ICONS: Record<string, React.ReactNode> = {
  innovation: <Lightbulb className="w-3.5 h-3.5" />,
  technical_execution: <Cpu className="w-3.5 h-3.5" />,
  functional_completeness: <Check className="w-3.5 h-3.5" />,
  problem_solution_fit: <TrendingUp className="w-3.5 h-3.5" />,
  ux_design: <Eye className="w-3.5 h-3.5" />,
  demo_communication: <MessageSquare className="w-3.5 h-3.5" />,
  learning_ambition: <Star className="w-3.5 h-3.5" />,
};

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color =
    score >= 8 ? "bg-green-400" :
    score >= 6 ? "bg-blue-400" :
    score >= 4 ? "bg-yellow-400" :
    "bg-red-400";
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden w-full">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PassStatus({ pass }: { pass: HackathonAIAnalysis | undefined }) {
  if (!pass) return <span className="text-gray-600 text-[11px]">—</span>;
  if (pass.status === "running") return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
  if (pass.status === "complete") return <Check className="w-3.5 h-3.5 text-green-400" />;
  if (pass.status === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  return <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />;
}

interface Props {
  teamId: string;
  teamName: string;
  eventId: string;
  adminCode: string;
  analyses: HackathonAIAnalysis[];
  hasRepo: boolean;
}

export function AIAnalysisPanel({ teamId, teamName, eventId, adminCode, analyses, hasRepo }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [applyDone, setApplyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byPass = Object.fromEntries(analyses.map((a) => [a.pass_name, a]));
  const pass6 = byPass["pass6_synthesis"]?.result as Pass6Result | undefined;
  const isRunning = analyses.some((a) => a.status === "running");
  const allDone = ["pass1_repo", "pass2_code", "pass3_innovation", "pass4_visual", "pass5_pool", "pass6_synthesis"]
    .every((p) => byPass[p]?.status === "complete");
  const hasStarted = analyses.length > 0;

  const completedCount = Object.values(byPass).filter((a) => a.status === "complete").length;

  return (
    <div className="border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">AI Judge</span>
          </div>

          {hasStarted && (
            <div className="flex items-center gap-1.5">
              {Object.keys(PASS_LABELS).map((p) => (
                <PassStatus key={p} pass={byPass[p]} />
              ))}
              {isRunning && (
                <span className="text-[10px] text-gray-500 ml-1">
                  {completedCount}/6
                </span>
              )}
            </div>
          )}

          {pass6 && (
            <span className="text-[13px] font-semibold text-white ml-1">
              {pass6.overall_score.toFixed(1)}<span className="text-gray-600 text-[10px]">/10</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!hasStarted && !isRunning && (
            <button
              disabled={isPending || !hasRepo}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await triggerAnalysis(teamId, eventId);
                  if (res.error) setError(res.error);
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-purple-400/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/30 transition-all disabled:opacity-40"
              title={!hasRepo ? "Team must submit a repo URL first" : undefined}
            >
              <Sparkles className="w-3 h-3" />
              {isPending ? "Starting…" : "Analyze"}
            </button>
          )}

          {hasStarted && !isRunning && !allDone && (
            <button
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await triggerAnalysis(teamId, eventId);
                  if (res.error) setError(res.error);
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            >
              Retry
            </button>
          )}

          {allDone && !applyDone && (
            <button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const res = await applyAIScores(adminCode, teamId, eventId);
                  if (res.error) setError(res.error);
                  else setApplyDone(true);
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-green-400/40 bg-green-500/15 text-green-300 hover:bg-green-500/30 transition-all disabled:opacity-40"
            >
              <Check className="w-3 h-3" />
              {isPending ? "Applying…" : "Apply Scores"}
            </button>
          )}

          {applyDone && (
            <span className="text-[11px] text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Applied
            </span>
          )}

          {allDone && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-white transition-colors p-1"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-[12px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Expanded report */}
      {expanded && pass6 && (
        <div className="px-4 py-4 space-y-4 border-t border-white/[0.06]">
          {/* Overall */}
          <div className="glass rounded-2xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Overall Score</span>
              <span className="text-2xl font-light text-white">{pass6.overall_score.toFixed(1)}<span className="text-sm text-gray-600">/10</span></span>
            </div>
            <p className="text-[13px] text-gray-300 leading-relaxed">{pass6.most_impressive_aspect}</p>

            {pass6.recommended_award_categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {pass6.recommended_award_categories.map((cat) => (
                  <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/25 text-purple-300">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Criteria scores */}
          <div className="space-y-2">
            {pass6.criteria_scores.map((c) => (
              <div key={c.criteria_key}>
                <button
                  onClick={() => setExpandedCriteria(expandedCriteria === c.criteria_key ? null : c.criteria_key)}
                  className="w-full flex items-center gap-3 py-2 hover:bg-white/[0.02] rounded-xl px-2 transition-colors"
                >
                  <span className="text-gray-500">
                    {CRITERIA_ICONS[c.criteria_key] ?? <Star className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-[12px] text-gray-300 flex-1 text-left capitalize">
                    {c.criteria_key.replace(/_/g, " ")}
                  </span>
                  <div className="w-24 hidden sm:block">
                    <ScoreBar score={c.score} />
                  </div>
                  <span className="text-[13px] font-medium text-white tabular-nums w-10 text-right">
                    {c.score.toFixed(1)}
                  </span>
                  <span className={cn(
                    "text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border",
                    c.confidence === "high" ? "border-green-400/30 text-green-400 bg-green-400/10" :
                    c.confidence === "medium" ? "border-yellow-400/30 text-yellow-400 bg-yellow-400/10" :
                    "border-gray-500/30 text-gray-500 bg-white/5"
                  )}>
                    {c.confidence}
                  </span>
                </button>
                {expandedCriteria === c.criteria_key && (
                  <div className="ml-8 mr-2 mb-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-[12px] text-gray-400 leading-relaxed">{c.reasoning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Judge briefing + concerns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pass6.judge_briefing_points.length > 0 && (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> For Human Judges
                </p>
                <ul className="space-y-1">
                  {pass6.judge_briefing_points.map((pt, i) => (
                    <li key={i} className="text-[12px] text-gray-400 flex gap-2">
                      <span className="text-gray-600 shrink-0">·</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pass6.concerns_and_limitations.length > 0 && (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" /> Concerns
                </p>
                <ul className="space-y-1">
                  {pass6.concerns_and_limitations.map((c, i) => (
                    <li key={i} className="text-[12px] text-gray-400 flex gap-2">
                      <span className="text-gray-600 shrink-0">·</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
