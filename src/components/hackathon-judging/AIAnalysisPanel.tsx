"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { resetAnalysis, triggerAnalysis } from "@/lib/actions/hackathon-analysis";
import { mergeTeamAnalyses, sortAnalyses } from "@/lib/hackathon-analysis/admin-utils";
import { createClient } from "@/lib/supabase/client";
import {
  Cpu, ChevronDown, ChevronUp, Check, AlertCircle, Loader2,
  Star, TrendingUp, Eye, Users, Lightbulb, RotateCcw, Copy,
} from "lucide-react";
import type { HackathonAIAnalysis, HackathonAIJob } from "@/lib/hackathon-analysis/types";
import type { Pass6Result } from "@/lib/hackathon-analysis/types";

const PASS_LABELS: Record<string, string> = {
  pass1_repo: "Repo Archaeology",
  pass2_code: "Code Deep-Dive",
  pass3_innovation: "Innovation Audit",
  pass4_visual: "Visual / UX",
  pass5_pool: "Pool Comparison",
  pass6_synthesis: "Synthesis",
};

const PASS_ORDER = [
  "pass1_repo",
  "pass2_code",
  "pass3_innovation",
  "pass4_visual",
  "pass5_pool",
  "pass6_synthesis",
] as const;

const STUCK_THRESHOLD_MS = 3 * 60 * 1000;

function upsertAnalyses(
  current: HackathonAIAnalysis[],
  incoming: HackathonAIAnalysis[]
) {
  return mergeTeamAnalyses(current, incoming);
}

const CRITERIA_ICONS: Record<string, React.ReactNode> = {
  innovation: <Lightbulb className="w-3.5 h-3.5" />,
  technical_execution: <Cpu className="w-3.5 h-3.5" />,
  functional_completeness: <Check className="w-3.5 h-3.5" />,
  problem_solution_fit: <TrendingUp className="w-3.5 h-3.5" />,
  ux_design: <Eye className="w-3.5 h-3.5" />,
  learning_ambition: <Star className="w-3.5 h-3.5" />,
};

function PassStatus({ pass }: { pass: HackathonAIAnalysis | undefined }) {
  if (!pass) return <span className="text-gray-600 text-[11px]">—</span>;
  if (pass.status === "running") return <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />;
  if (pass.status === "complete") return <Check className="w-3.5 h-3.5 text-green-400" />;
  if (pass.status === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  if (pass.status === "cancelled") return <span className="text-gray-500 text-[10px]">✕</span>;
  return <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />;
}

function formatElapsed(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  return `${Math.round(ms / 60_000)}m ago`;
}

function passSummary(pass: HackathonAIAnalysis | undefined): string | null {
  if (!pass?.result || typeof pass.result !== "object") return null;
  const r = pass.result as unknown as Record<string, unknown>;
  if (typeof r.readme_summary === "string") return r.readme_summary.slice(0, 160);
  if (typeof r.architecture_notes === "string") return r.architecture_notes.slice(0, 160);
  if (typeof r.problem_novelty_notes === "string") return r.problem_novelty_notes.slice(0, 160);
  if (typeof r.relative_standing === "string") return r.relative_standing.slice(0, 160);
  if (typeof r.overall_score === "number") return `Overall ${r.overall_score}/10`;
  if (typeof r.overall_visual_score === "number") {
    return `Visual ${r.overall_visual_score}/10 · ${r.screenshots_analyzed ?? "?"} shots`;
  }
  return null;
}

interface Props {
  teamId: string;
  teamName: string;
  eventId: string;
  adminCode: string;
  analyses: HackathonAIAnalysis[];
  hasRepo: boolean;
  job?: HackathonAIJob | null;
  onAnalysesChange?: (analyses: HackathonAIAnalysis[]) => void;
}

export function AIAnalysisPanel({
  teamId, teamName, eventId, adminCode, analyses, hasRepo, job, onAnalysesChange,
}: Props) {
  const [liveAnalyses, setLiveAnalyses] = useState(() => sortAnalyses(analyses));
  const [expanded, setExpanded] = useState(false);
  const [expandedPass, setExpandedPass] = useState<string | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticStarted, setOptimisticStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAnalyses = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hackathon_ai_analyses")
      .select("*")
      .eq("team_id", teamId)
      .eq("event_id", eventId)
      .order("pass_name");

    if (data) setLiveAnalyses(sortAnalyses(data as HackathonAIAnalysis[]));
  }, [eventId, teamId]);

  useEffect(() => {
    void fetchAnalyses();
  }, [fetchAnalyses]);

  useEffect(() => {
    if (analyses.length === 0) return;
    setLiveAnalyses((prev) => upsertAnalyses(prev, analyses));
  }, [analyses]);

  useEffect(() => {
    onAnalysesChange?.(liveAnalyses);
  }, [liveAnalyses, onAnalysesChange]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`hackathon-ai-panel-${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hackathon_ai_analyses", filter: `team_id=eq.${teamId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            void fetchAnalyses();
            return;
          }
          const row = payload.new as HackathonAIAnalysis | null;
          if (!row || row.event_id !== eventId) return;
          setLiveAnalyses((prev) => upsertAnalyses(prev, [row]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, teamId, fetchAnalyses]);

  const byPass = Object.fromEntries(liveAnalyses.map((a) => [a.pass_name, a])) as Partial<Record<(typeof PASS_ORDER)[number], HackathonAIAnalysis>>;
  const pass6 = byPass["pass6_synthesis"]?.result as Pass6Result | undefined;
  const isRunning = liveAnalyses.some((a) => a.status === "running") || job?.status === "running" || job?.status === "queued";
  const hasAnalysisError = liveAnalyses.some((a) => a.status === "error") || job?.status === "error";
  const allDone = PASS_ORDER.every((p) => byPass[p]?.status === "complete");
  const hasStarted = liveAnalyses.length > 0 || optimisticStarted || Boolean(job);

  useEffect(() => {
    if (!hasStarted || allDone) return;
    // Keep polling while queued/running OR while errored (job may be retried externally)
    void fetchAnalyses();
    const interval = window.setInterval(() => {
      void fetchAnalyses();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [allDone, fetchAnalyses, hasStarted, isRunning]);

  const completedCount = Object.values(byPass).filter((a) => a.status === "complete").length;
  const runningPass = PASS_ORDER.find((p) => byPass[p]?.status === "running");
  const runningPassRow = runningPass ? byPass[runningPass] : undefined;
  const isLikelyStuck = Boolean(
    (runningPassRow?.updated_at &&
      Date.now() - new Date(runningPassRow.updated_at).getTime() > STUCK_THRESHOLD_MS) ||
    (job?.status === "running" &&
      job.heartbeat_at &&
      Date.now() - new Date(job.heartbeat_at).getTime() > STUCK_THRESHOLD_MS)
  );
  const failedPass = PASS_ORDER.find((p) => byPass[p]?.status === "error");
  const failedError = failedPass ? byPass[failedPass]?.error : job?.last_error ?? null;

  const statusMessage = failedPass || job?.status === "error"
    ? `${failedPass ? PASS_LABELS[failedPass] : "Job"} failed`
    : isRunning && (runningPass || job?.current_pass)
      ? `Running ${PASS_LABELS[runningPass ?? (job?.current_pass as string)] ?? job?.current_pass ?? "…"} (${completedCount}/6 complete)`
      : allDone
        ? "Analysis complete. Review the synthesis."
        : hasStarted
          ? `Analysis queued (${completedCount}/6 complete)`
          : null;

  const startAnalysisRun = (force = false) => {
    setError(null);
    setOptimisticStarted(true);
    startTransition(async () => {
      const res = await triggerAnalysis(teamId, eventId, adminCode, { force });
      if (res.error) {
        setOptimisticStarted(false);
        setError(res.error);
        return;
      }
      void fetchAnalyses();
    });
  };

  const handleReset = () => {
    if (!confirm(`Reset AI analysis for ${teamName}? You can run Analyze again afterward.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await resetAnalysis(teamId, eventId, adminCode);
      if (res.error) {
        setError(res.error);
        return;
      }
      setLiveAnalyses([]);
      setOptimisticStarted(false);
      setExpanded(false);
      setExpandedPass(null);
    });
  };

  const handleReRun = () => {
    if (!confirm(`Re-run AI analysis for ${teamName} from scratch? Current scores will be cleared.`)) return;
    startAnalysisRun(true);
  };

  const copyError = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const showAnalyze = !hasStarted;
  const showRetry = hasStarted && !allDone;
  const showReset = hasStarted && !allDone;
  const showReRun = allDone;

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-red-500/20 bg-black/40 backdrop-blur-xl shadow-2xl transition-all hover:border-red-500/40 group">
      <div className="absolute inset-0 bg-grid-red/[0.02] bg-[size:15px_15px]" />
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex flex-wrap items-center justify-between px-4 py-4 bg-white/[0.02] border-b border-white/5 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 shadow-neon overflow-hidden relative shrink-0">
            <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
            <img src="/cursor-logo.svg" alt="Cursor" className="w-4 h-4 relative z-10 drop-shadow-[0_0_5px_rgba(255,255,255,0.8)] brightness-200" />
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-red-300">AI Judge</span>
            {job && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/15 text-gray-400">
                job:{job.status}{job.attempt > 0 ? ` · try ${job.attempt + 1}` : ""}
              </span>
            )}
            {hasStarted && (
              <div className="flex items-center gap-1.5">
                {PASS_ORDER.map((p) => (
                  <PassStatus key={p} pass={byPass[p]} />
                ))}
                {(isRunning || hasStarted) && (
                  <span className="text-[10px] font-bold text-gray-500 ml-1">
                    {completedCount}/6
                  </span>
                )}
              </div>
            )}
            {pass6 && (
              <span className="text-[14px] font-black text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/20">
                {pass6.overall_score.toFixed(1)}<span className="text-gray-500 text-[10px]">/10</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          {showAnalyze && (
            <button
              disabled={isPending || !hasRepo}
              onClick={() => startAnalysisRun(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-red-500/40 bg-red-500/20 text-red-200 hover:bg-red-500/30 hover:border-red-500/60 transition-all disabled:opacity-40 shadow-neon"
              title={!hasRepo ? "Team must submit a repo URL first" : undefined}
            >
              <Cpu className="w-3.5 h-3.5" />
              {isPending ? "Starting…" : "Analyze"}
            </button>
          )}

          {showRetry && (
            <button
              disabled={isPending || !hasRepo}
              onClick={() => startAnalysisRun(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/15 bg-white/5 text-gray-200 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all disabled:opacity-40"
              title="Re-queue from last complete pass (or restart after error/stuck)"
            >
              Retry
            </button>
          )}

          {showReset && (
            <button
              disabled={isPending}
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 hover:border-amber-400/60 transition-all disabled:opacity-40"
              title="Clear all passes and cancel the job"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isPending ? "Resetting…" : "Reset"}
            </button>
          )}

          {showReRun && (
            <button
              disabled={isPending || !hasRepo}
              onClick={handleReRun}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/15 bg-white/5 text-gray-300 hover:text-white transition-all disabled:opacity-40"
            >
              Re-run
            </button>
          )}

          {hasStarted && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 ml-1"
              title="Expand pass details"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {hasStarted && (
        <div className="relative px-5 py-3 border-t border-white/5 bg-black/20 space-y-2">
          <div className="flex flex-wrap gap-2">
            {PASS_ORDER.map((passName) => {
              const pass = byPass[passName];
              return (
                <button
                  key={passName}
                  type="button"
                  onClick={() => setExpandedPass(expandedPass === passName ? null : passName)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                    pass?.status === "complete" && "border-green-500/30 bg-green-500/10 text-green-300",
                    pass?.status === "running" && "border-red-500/30 bg-red-500/10 text-red-200",
                    pass?.status === "error" && "border-red-500/40 bg-red-500/15 text-red-300",
                    pass?.status === "cancelled" && "border-white/10 bg-white/5 text-gray-500",
                    (!pass || pass.status === "pending") && "border-white/10 bg-white/5 text-gray-500",
                    expandedPass === passName && "ring-1 ring-white/30"
                  )}
                >
                  <PassStatus pass={pass} />
                  <span>{PASS_LABELS[passName]}</span>
                </button>
              );
            })}
          </div>

          {statusMessage && (
            <p className={cn(
              "text-[12px] font-semibold",
              failedPass || job?.status === "error" ? "text-red-300" : allDone ? "text-green-300" : "text-gray-400"
            )}>
              {statusMessage}
              {isLikelyStuck && !failedPass && (
                <span className="text-amber-300/90"> — taking longer than expected; use Retry or Reset.</span>
              )}
            </p>
          )}

          {job && (
            <p className="text-[11px] text-gray-500">
              Job {job.status}
              {job.current_pass ? ` · ${job.current_pass}` : ""}
              {job.heartbeat_at ? ` · heartbeat ${formatElapsed(job.heartbeat_at)}` : ""}
              {job.last_error ? ` · ${job.last_error.slice(0, 120)}` : ""}
            </p>
          )}

          {failedError && (
            <div className="flex items-start gap-2">
              <p className="text-[12px] leading-relaxed text-red-300/90 break-words flex-1">
                {failedError}
              </p>
              <button
                type="button"
                onClick={() => void copyError(failedError)}
                className="shrink-0 p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white"
                title="Copy error"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {copied && <span className="text-[10px] text-green-400">Copied</span>}
            </div>
          )}

          {expandedPass && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5 text-[12px] text-gray-300">
              <p className="font-bold text-white">{PASS_LABELS[expandedPass]}</p>
              <p>Status: {byPass[expandedPass as typeof PASS_ORDER[number]]?.status ?? "missing"}</p>
              <p>Updated: {formatElapsed(byPass[expandedPass as typeof PASS_ORDER[number]]?.updated_at)}</p>
              <p>Model: {byPass[expandedPass as typeof PASS_ORDER[number]]?.model_used ?? "—"}</p>
              {byPass[expandedPass as typeof PASS_ORDER[number]]?.error && (
                <p className="text-red-300 break-words">
                  Error: {byPass[expandedPass as typeof PASS_ORDER[number]]?.error}
                </p>
              )}
              {passSummary(byPass[expandedPass as typeof PASS_ORDER[number]]) && (
                <p className="text-gray-400">{passSummary(byPass[expandedPass as typeof PASS_ORDER[number]])}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="relative px-5 py-3 bg-red-500/10 border-t border-red-500/20 text-red-400 text-[13px] font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {expanded && pass6 && (
        <div className="relative px-5 py-5 space-y-5 border-t border-white/5">
          <div className="relative overflow-hidden rounded-[20px] p-5 border border-white/10 bg-white/[0.02] space-y-4">
            <div className="relative flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">Overall Score</span>
              <span className="text-3xl font-black text-white tracking-tight">{pass6.overall_score.toFixed(1)}<span className="text-sm font-bold text-gray-600">/10</span></span>
            </div>
            <p className="relative text-[14px] font-medium text-gray-300 leading-relaxed">{pass6.most_impressive_aspect}</p>
            {pass6.recommended_award_categories.length > 0 && (
              <div className="relative flex flex-wrap gap-2 pt-2">
                {pass6.recommended_award_categories.map((cat) => (
                  <span key={cat} className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-200">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

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
                  <span className="text-[13px] font-bold text-gray-200 flex-1 text-left capitalize tracking-wide truncate">
                    {c.criteria_key.replace(/_/g, " ")}
                  </span>
                  <span className="text-[14px] font-black text-white tabular-nums shrink-0 text-right">
                    {c.score.toFixed(1)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pass6.judge_briefing_points.length > 0 && (
              <div className="rounded-[20px] bg-white/[0.02] border border-white/10 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-400" /> For Human Judges
                </p>
                <ul className="space-y-2">
                  {pass6.judge_briefing_points.map((pt, i) => (
                    <li key={i} className="text-[13px] font-medium text-gray-300 flex gap-2.5">
                      <span className="text-red-500/50 shrink-0">·</span>
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
