"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ExternalLink,
  Medal,
  Save,
  Trophy,
  Users,
  Cpu,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import {
  publishCompetitionJudgingResults,
  saveCompetitionJudgingScorecard,
  unpublishCompetitionJudgingResults,
} from "@/lib/actions/competition-judging";
import { cn } from "@/lib/utils";
import type { CompetitionJudgingCompetition, HackathonTeamWithMembers } from "@/types";
import type { HackathonAIAnalysis, Pass6Result } from "@/lib/hackathon-analysis/types";

interface Props {
  adminCode: string;
  eventSlug: string;
  adminUserId: string | null;
  competitions: CompetitionJudgingCompetition[];
  teams?: HackathonTeamWithMembers[];
  aiAnalyses?: Record<string, HackathonAIAnalysis[]>;
}

// ─── Inline AI summary for a single finalist entry ───────────────────────────

function EntryAISummary({ repoUrl, teams, aiAnalyses }: {
  repoUrl: string | null;
  teams: HackathonTeamWithMembers[];
  aiAnalyses: Record<string, HackathonAIAnalysis[]>;
}) {
  const [expanded, setExpanded] = useState(false);

  // Match entry to a team by repo_url
  const team = repoUrl
    ? teams.find((t) => t.project?.repo_url && t.project.repo_url.trim().replace(/\/$/, '') === repoUrl.trim().replace(/\/$/, ''))
    : null;

  if (!team) return null;

  const analyses = aiAnalyses[team.id] ?? [];
  const pass6Row = analyses.find((a) => a.pass_name === 'pass6_synthesis' && a.status === 'complete');
  const isRunning = analyses.some((a) => a.status === 'running');
  const completedPasses = analyses.filter((a) => a.status === 'complete').length;

  if (!pass6Row && !isRunning && analyses.length === 0) return null;

  const pass6 = pass6Row?.result as Pass6Result | undefined;

  const KEY_CRITERIA = ['innovation', 'technical_execution', 'functional_completeness', 'ux_design'];

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-purple-500/[0.06] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">AI Pre-Screen</span>
          {isRunning && (
            <span className="text-[10px] text-gray-500">{completedPasses}/6 passes…</span>
          )}
          {pass6 && (
            <span className="text-[14px] font-semibold text-white ml-1">
              {pass6.overall_score.toFixed(1)}<span className="text-[10px] text-gray-500">/10</span>
            </span>
          )}
          {!pass6 && !isRunning && analyses.length > 0 && (
            <span className="text-[10px] text-red-400">Analysis incomplete</span>
          )}
        </div>
        {pass6 && (expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />)}
      </button>

      {pass6 && expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-purple-500/15">
          {/* Score bars for key criteria */}
          <div className="grid grid-cols-2 gap-2 pt-3">
            {pass6.criteria_scores
              .filter((c) => KEY_CRITERIA.includes(c.criteria_key))
              .map((c) => (
                <div key={c.criteria_key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-gray-500 capitalize">
                      {c.criteria_key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-white tabular-nums">{c.score.toFixed(1)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full",
                        c.score >= 8 ? "bg-green-400" : c.score >= 6 ? "bg-blue-400" : c.score >= 4 ? "bg-yellow-400" : "bg-red-400"
                      )}
                      style={{ width: `${(c.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Most impressive */}
          {pass6.most_impressive_aspect && (
            <div className="flex gap-2 items-start">
              <Lightbulb className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-gray-300 leading-relaxed">{pass6.most_impressive_aspect}</p>
            </div>
          )}

          {/* Judge briefing */}
          {pass6.judge_briefing_points.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 flex items-center gap-1.5">
                <Users className="w-2.5 h-2.5" /> For Human Judges
              </p>
              <ul className="space-y-0.5">
                {pass6.judge_briefing_points.map((pt, i) => (
                  <li key={i} className="text-[11px] text-gray-400 flex gap-2">
                    <span className="text-gray-600 shrink-0">·</span>{pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {pass6.concerns_and_limitations.length > 0 && (
            <div className="flex gap-2 items-start">
              <AlertCircle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {pass6.concerns_and_limitations[0]}
                {pass6.concerns_and_limitations.length > 1 && ` (+${pass6.concerns_and_limitations.length - 1} more)`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ScoreDraft = Record<string, Record<string, number>>;

function formatScore(score: number, maxScore: number) {
  return `${score.toFixed(score % 1 === 0 ? 0 : 1)} / ${maxScore}`;
}

export function HackathonJudgingAdminPanel({
  adminCode,
  eventSlug,
  adminUserId,
  competitions,
  teams = [],
  aiAnalyses = {},
}: Props) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(competitions[0]?.id ?? "");
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDraft>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const competition = useMemo(
    () => competitions.find((comp) => comp.id === selectedCompetitionId) ?? competitions[0] ?? null,
    [competitions, selectedCompetitionId]
  );

  useEffect(() => {
    if (!competition || selectedCompetitionId) return;
    setSelectedCompetitionId(competition.id);
  }, [competition, selectedCompetitionId]);

  useEffect(() => {
    if (!competition || !adminUserId) return;

    const nextScores: ScoreDraft = {};
    const nextNotes: Record<string, string> = {};
    for (const finalist of competition.finalists) {
      const scorecard = competition.scorecards.find(
        (card) => card.entry_id === finalist.entry_id && card.judge_id === adminUserId
      );
      nextScores[finalist.entry_id] = {};
      for (const criterion of competition.criteria) {
        const item = scorecard?.items?.find((scoreItem) => scoreItem.criterion_id === criterion.id);
        nextScores[finalist.entry_id][criterion.id] = Number(item?.points ?? 0);
      }
      nextNotes[finalist.entry_id] = scorecard?.notes ?? "";
    }
    setScoreDrafts(nextScores);
    setNotesDrafts(nextNotes);
  }, [competition, adminUserId]);

  if (competitions.length === 0) {
    return (
      <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
        Create a competition and collect project entries before judging.
      </div>
    );
  }

  if (!competition) return null;

  const maxScore = competition.criteria.reduce((sum, criterion) => sum + Number(criterion.max_points), 0) || 100;
  const published = competition.results.filter((result) => result.is_published);

  const saveEntryScore = (entryId: string) => {
    setActiveEntryId(entryId);
    setError(null);
    setSavedEntryId(null);
    startTransition(async () => {
      const res = await saveCompetitionJudgingScorecard(
        competition.id,
        entryId,
        adminCode,
        competition.criteria.map((criterion) => ({
          criterionId: criterion.id,
          points: Number(scoreDrafts[entryId]?.[criterion.id] ?? 0),
        })),
        notesDrafts[entryId] ?? ""
      );

      if (res.error) {
        setError(res.error);
      } else {
        setSavedEntryId(entryId);
      }
      setActiveEntryId(null);
    });
  };

  const publishResults = () => {
    setError(null);
    startTransition(async () => {
      const res = await publishCompetitionJudgingResults(competition.id, eventSlug, adminCode, 3);
      if (res.error) setError(res.error);
    });
  };

  const unpublishResults = () => {
    if (!confirm("Unpublish the current judging results?")) return;
    setError(null);
    startTransition(async () => {
      const res = await unpublishCompetitionJudgingResults(competition.id, eventSlug, adminCode);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="glass rounded-[28px] p-5 border-white/20 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-400">Final Round — Human Judging</p>
            <h3 className="text-lg font-light mt-1">Score Finalists</h3>
            <p className="text-[11px] text-gray-500 mt-1">AI pre-screen scores shown above each entry for reference. Add your own scores below.</p>
          </div>
          <select
            value={competition.id}
            onChange={(e) => {
              setSelectedCompetitionId(e.target.value);
              setSavedEntryId(null);
              setError(null);
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 [&_option]:bg-white [&_option]:text-gray-900"
          >
            {competitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-2xl font-light">{competition.finalists.length}</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mt-1">Finalists</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-2xl font-light">{competition.criteria.length}</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mt-1">Criteria</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-2xl font-light">{maxScore}</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 mt-1">Max Score</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3">
            {error}
          </div>
        )}
      </div>

      {competition.finalists.length === 0 && (
        <div className="glass rounded-[32px] p-10 border-white/20 text-center space-y-2">
          <p className="text-sm text-white/80">No finalists selected yet.</p>
          <p className="text-xs text-gray-500">
            Go to the <strong className="text-gray-400">Competitions</strong> admin page → select entries → click <strong className="text-gray-400">&ldquo;Add to Final Round&rdquo;</strong> to bring them here for judging.
          </p>
        </div>
      )}

      {competition.finalists.map((finalist) => {
        const entry = finalist.entry ?? competition.entries.find((candidate) => candidate.id === finalist.entry_id);
        if (!entry) return null;
        const draftTotal = competition.criteria.reduce(
          (sum, criterion) => sum + Number(scoreDrafts[entry.id]?.[criterion.id] ?? 0),
          0
        );

        return (
          <div key={finalist.id} className="glass rounded-[28px] p-6 border-white/20 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                  Finalist #{finalist.position + 1}
                </p>
                <h4 className="text-xl font-light text-white">{entry.title}</h4>
                <p className="text-xs text-gray-500">{entry.user?.name ?? "Unknown submitter"}</p>
                {entry.description && <p className="text-sm text-gray-400">{entry.description}</p>}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={entry.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white"
                  >
                    Repo <ExternalLink className="w-3 h-3" />
                  </a>
                  {entry.project_url && (
                    <a
                      href={entry.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white"
                    >
                      Demo <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-light tabular-nums">{draftTotal}</p>
                <p className="text-[9px] uppercase tracking-[0.15em] text-gray-600">/ {maxScore} pts</p>
              </div>
            </div>

            {/* AI pre-screen summary */}
            <EntryAISummary repoUrl={entry.repo_url} teams={teams} aiAnalyses={aiAnalyses} />

            {/* Human judge scoring */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3">Your Judge Score</p>
            </div>
            <div className="space-y-3">
              {competition.criteria.map((criterion) => (
                <div key={criterion.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{criterion.label}</span>
                    <span className="text-xs tabular-nums text-white/70">
                      {scoreDrafts[entry.id]?.[criterion.id] ?? 0}/{Number(criterion.max_points)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Number(criterion.max_points)}
                    step={1}
                    value={scoreDrafts[entry.id]?.[criterion.id] ?? 0}
                    onChange={(e) =>
                      setScoreDrafts((prev) => ({
                        ...prev,
                        [entry.id]: {
                          ...(prev[entry.id] ?? {}),
                          [criterion.id]: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-white"
                  />
                  {criterion.description && (
                    <p className="text-[11px] text-gray-600">{criterion.description}</p>
                  )}
                </div>
              ))}
            </div>

            <textarea
              placeholder="Judge notes..."
              rows={2}
              value={notesDrafts[entry.id] ?? ""}
              onChange={(e) => setNotesDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
            />

            <button
              disabled={isPending || !adminUserId || activeEntryId === entry.id}
              onClick={() => saveEntryScore(entry.id)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/10 py-2.5 text-sm text-white hover:bg-white/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {activeEntryId === entry.id ? "Saving..." : savedEntryId === entry.id ? "Saved" : "Save Scorecard"}
            </button>
          </div>
        );
      })}

      <div className="glass rounded-[28px] p-6 border-white/20 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Aggregate Standings</p>
            <h4 className="text-lg font-light mt-1">Calculated from judge scorecards</h4>
          </div>
          <div className="flex gap-2">
            {published.length > 0 && (
              <button
                disabled={isPending}
                onClick={unpublishResults}
                className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                Unpublish
              </button>
            )}
            <button
              disabled={isPending || competition.standings.length === 0}
              onClick={publishResults}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-500/20 px-3 py-2 text-xs text-yellow-200 hover:bg-yellow-500/30 disabled:opacity-50"
            >
              <Trophy className="w-3.5 h-3.5" />
              Publish Top 3
            </button>
          </div>
        </div>

        {competition.standings.length === 0 ? (
          <p className="text-sm text-gray-500">No standings yet. Select finalists and save at least one scorecard.</p>
        ) : (
          <div className="space-y-2">
            {competition.standings.map((standing) => (
              <div
                key={standing.entry_id}
                className={cn(
                  "rounded-2xl border p-4 flex items-center gap-4",
                  standing.placement === 1
                    ? "border-yellow-400/30 bg-yellow-400/10"
                    : "border-white/10 bg-white/5"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  {standing.placement <= 3 ? <Medal className="w-4 h-4 text-yellow-300" /> : standing.placement}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{standing.entry.title}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                    {standing.judge_count} judge{standing.judge_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm tabular-nums text-white/80">
                  {formatScore(standing.final_score, standing.max_score)}
                </p>
              </div>
            ))}
          </div>
        )}

        {published.length > 0 && (
          <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-300 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Winners are published to attendees.
          </div>
        )}
      </div>
    </div>
  );
}
