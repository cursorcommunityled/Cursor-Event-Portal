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
    <div className="relative overflow-hidden rounded-[24px] border border-purple-500/20 bg-black/40 backdrop-blur-xl shadow-2xl transition-all hover:border-purple-500/40 group">
      <div className="absolute inset-0 bg-grid-purple/[0.02] bg-[size:15px_15px]" />
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-500/10 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-4 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 shadow-neon overflow-hidden relative">
            <div className="absolute inset-0 bg-purple-500/20 animate-pulse" />
            <img src="/cursor-logo.svg" alt="Cursor" className="w-4 h-4 relative z-10 drop-shadow-[0_0_5px_rgba(255,255,255,0.8)] brightness-200" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-purple-300">AI Judge</span>
            {hasStarted && (
              <div className="flex items-center gap-2">
                {Object.keys(PASS_LABELS).map((p) => (
                  <PassStatus key={p} pass={byPass[p]} />
                ))}
                {isRunning && (
                  <span className="text-[10px] font-bold text-gray-500 ml-1">
                    {completedCount}/6
                  </span>
                )}
              </div>
            )}
            {pass6 && (
              <span className="text-[14px] font-black text-white ml-2 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/20">
                {pass6.overall_score.toFixed(1)}<span className="text-gray-500 text-[10px]">/10</span>
              </span>
            )}
          </div>
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-purple-500/40 bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 hover:border-purple-500/60 transition-all disabled:opacity-40 shadow-neon"
              title={!hasRepo ? "Team must submit a repo URL first" : undefined}
            >
              <Sparkles className="w-3.5 h-3.5" />
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all disabled:opacity-40"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-green-500/40 bg-green-500/20 text-green-300 hover:bg-green-500/30 hover:border-green-500/60 transition-all disabled:opacity-40 shadow-neon-green"
            >
              <Check className="w-3.5 h-3.5" />
              {isPending ? "Applying…" : "Apply Scores"}
            </button>
          )}

          {applyDone && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 rounded-xl border border-green-500/20">
              <Check className="w-3.5 h-3.5" /> Applied
            </span>
          )}

          {allDone && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 ml-1"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="relative px-5 py-3 bg-red-500/10 border-t border-red-500/20 text-red-400 text-[13px] font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Expanded report */}
      {expanded && pass6 && (
        <div className="relative px-5 py-5 space-y-5 border-t border-white/5">
          {/* Overall */}
          <div className="relative overflow-hidden rounded-[20px] p-5 border border-white/10 bg-white/[0.02] space-y-4">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
            <div className="relative flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">Overall Score</span>
              <span className="text-3xl font-black text-white tracking-tight">{pass6.overall_score.toFixed(1)}<span className="text-sm font-bold text-gray-600">/10</span></span>
            </div>
            <p className="relative text-[14px] font-medium text-gray-300 leading-relaxed">{pass6.most_impressive_aspect}</p>

            {pass6.recommended_award_categories.length > 0 && (
              <div className="relative flex flex-wrap gap-2 pt-2">
                {pass6.recommended_award_categories.map((cat) => (
                  <span key={cat} className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
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
                  className="w-full flex items-center gap-3 py-3 hover:bg-white/5 rounded-xl px-3 transition-colors border border-transparent hover:border-white/10"
                >
                  <span className="text-gray-400">
                    {CRITERIA_ICONS[c.criteria_key] ?? <Star className="w-4 h-4" />}
                  </span>
                  <span className="text-[13px] font-bold text-gray-200 flex-1 text-left capitalize tracking-wide">
                    {c.criteria_key.replace(/_/g, " ")}
                  </span>
                  <div className="w-32 hidden sm:block">
                    <ScoreBar score={c.score} />
                  </div>
                  <span className="text-[14px] font-black text-white tabular-nums w-10 text-right">
                    {c.score.toFixed(1)}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full border",
                    c.confidence === "high" ? "border-green-500/40 text-green-400 bg-green-500/10 shadow-[0_0_10px_rgba(74,222,128,0.1)]" :
                    c.confidence === "medium" ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.1)]" :
                    "border-gray-500/40 text-gray-400 bg-white/5"
                  )}>
                    {c.confidence}
                  </span>
                </button>
                {expandedCriteria === c.criteria_key && (
                  <div className="ml-10 mr-3 mb-3 mt-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-[13px] font-medium text-gray-400 leading-relaxed">{c.reasoning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Judge briefing + concerns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pass6.judge_briefing_points.length > 0 && (
              <div className="rounded-[20px] bg-white/[0.02] border border-white/10 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> For Human Judges
                </p>
                <ul className="space-y-2">
                  {pass6.judge_briefing_points.map((pt, i) => (
                    <li key={i} className="text-[13px] font-medium text-gray-300 flex gap-2.5">
                      <span className="text-blue-500/50 shrink-0">·</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pass6.concerns_and_limitations.length > 0 && (
              <div className="rounded-[20px] bg-white/[0.02] border border-white/10 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400" /> Concerns
                </p>
                <ul className="space-y-2">
                  {pass6.concerns_and_limitations.map((c, i) => (
                    <li key={i} className="text-[13px] font-medium text-gray-300 flex gap-2.5">
                      <span className="text-orange-500/50 shrink-0">·</span>
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
