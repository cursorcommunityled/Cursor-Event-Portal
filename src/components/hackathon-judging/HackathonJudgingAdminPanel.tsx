"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  resetCompetitionFinalRound,
  saveCompetitionJudgingScorecard,
  setCompetitionFinalists,
  unpublishCompetitionJudgingResults,
} from "@/lib/actions/competition-judging";
import { saveFinalRoundPrizeSettings } from "@/lib/actions/hackathon";
import { cn } from "@/lib/utils";
import { HACKATHON_SCORE_CATEGORIES } from "@/lib/hackathon-rubric";
import type {
  CompetitionEntry,
  CompetitionJudgingCompetition,
  HackathonPrize,
  HackathonSettings,
  HackathonTeamWithMembers,
} from "@/types";
import type { HackathonAIAnalysis, Pass6Result } from "@/lib/hackathon-analysis/types";

interface Props {
  adminCode: string;
  eventSlug: string;
  adminUserId: string | null;
  isGuestJudge?: boolean;
  competitions: CompetitionJudgingCompetition[];
  settings: HackathonSettings | null;
  teams?: HackathonTeamWithMembers[];
  aiAnalyses?: Record<string, HackathonAIAnalysis[]>;
}

const JUDGE_NAME_STORAGE_KEY = "hk_judge_name";

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

  const KEY_CRITERIA: string[] = HACKATHON_SCORE_CATEGORIES.map((criterion) => criterion.key);

  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Cpu className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">AI Pre-Screen</span>
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
        <div className="px-4 pb-4 space-y-3 border-t border-red-500/15">
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
                        c.score >= 8 ? "bg-green-400" : c.score >= 6 ? "bg-red-400" : c.score >= 4 ? "bg-yellow-400" : "bg-red-400"
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
type FinalistDrafts = Record<string, string[]>;

const MAX_PAID_PLACES = 10;

function placementLabel(placement: number) {
  if (placement === 1) return "1st Place";
  if (placement === 2) return "2nd Place";
  if (placement === 3) return "3rd Place";
  return `${placement}th Place`;
}

function defaultPrize(placement: number): HackathonPrize {
  return {
    placement,
    label: placementLabel(placement),
    cashValue: null,
    cursorCredits: null,
    notes: null,
    isPublic: true,
  };
}

function normalizePrizeDrafts(paidPlaces: number, prizes: HackathonPrize[] | null | undefined) {
  const clampedPlaces = Math.min(Math.max(Math.floor(paidPlaces || 1), 1), MAX_PAID_PLACES);
  const byPlacement = new Map((prizes ?? []).map((prize) => [Number(prize.placement), prize]));

  return Array.from({ length: clampedPlaces }, (_, index) => {
    const placement = index + 1;
    const existing = byPlacement.get(placement);
    return {
      ...defaultPrize(placement),
      ...existing,
      placement,
      label: existing?.label?.trim() || placementLabel(placement),
      cashValue: existing?.cashValue ?? null,
      cursorCredits: existing?.cursorCredits ?? null,
      notes: existing?.notes ?? null,
      isPublic: existing?.isPublic ?? true,
    };
  });
}

function formatPrizeValue(prize: HackathonPrize | null | undefined) {
  if (!prize) return "No prize configured";
  const parts = [
    prize.cashValue ? `$${prize.cashValue.toLocaleString()}` : null,
    prize.cursorCredits ? `${prize.cursorCredits.toLocaleString()} Cursor credits` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : "Prize details TBD";
}

function formatScore(score: number, maxScore: number) {
  return `${score.toFixed(score % 1 === 0 ? 0 : 1)} / ${maxScore}`;
}

export function HackathonJudgingAdminPanel({
  adminCode,
  eventSlug,
  adminUserId,
  isGuestJudge = false,
  competitions,
  settings,
  teams = [],
  aiAnalyses = {},
}: Props) {
  const router = useRouter();
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(competitions[0]?.id ?? "");
  const [judgeName, setJudgeName] = useState("");
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDraft>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [finalistDrafts, setFinalistDrafts] = useState<FinalistDrafts>({});
  const [finalistStatus, setFinalistStatus] = useState<"idle" | "pending" | "saved">("idle");
  const [paidPlaces, setPaidPlaces] = useState(settings?.final_round_paid_places ?? 3);
  const [prizeDrafts, setPrizeDrafts] = useState<HackathonPrize[]>(
    () => normalizePrizeDrafts(settings?.final_round_paid_places ?? 3, settings?.final_round_prizes)
  );
  const [prizeStatus, setPrizeStatus] = useState<"idle" | "pending" | "saved">("idle");
  const [isPending, startTransition] = useTransition();

  // Track which entries have unsaved local changes so remote refreshes don't
  // wipe a judge's in-progress slider positions when other judges save.
  const dirtyRef = useRef<Set<string>>(new Set());
  const [dirtyEntries, setDirtyEntries] = useState<Set<string>>(new Set());

  const markDirty = (entryId: string) => {
    dirtyRef.current.add(entryId);
    setDirtyEntries((prev) => { const s = new Set(prev); s.add(entryId); return s; });
  };
  const clearDirty = (entryId: string) => {
    dirtyRef.current.delete(entryId);
    setDirtyEntries((prev) => { const s = new Set(prev); s.delete(entryId); return s; });
  };
  const clearAllDirty = () => {
    dirtyRef.current.clear();
    setDirtyEntries(new Set());
  };

  // Guest judges (scoring via the admin URL without logging in) pick a display
  // name once; persist it per-browser so it sticks across refreshes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(JUDGE_NAME_STORAGE_KEY);
    if (stored) setJudgeName(stored);
  }, []);

  const updateJudgeName = (value: string) => {
    setJudgeName(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(JUDGE_NAME_STORAGE_KEY, value);
    }
  };

  const competition = useMemo(
    () => competitions.find((comp) => comp.id === selectedCompetitionId) ?? competitions[0] ?? null,
    [competitions, selectedCompetitionId]
  );

  // Clear dirty tracking when the judge explicitly switches to a different competition.
  useEffect(() => {
    clearAllDirty();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetitionId]);

  useEffect(() => {
    if (!competition || !adminUserId) return;

    const nextScores: ScoreDraft = {};
    const nextNotes: Record<string, string> = {};
    for (const finalist of competition.finalists) {
      // Don't overwrite entries the judge is actively editing — preserve their
      // in-progress slider positions across real-time refreshes from other judges.
      if (dirtyRef.current.has(finalist.entry_id)) continue;
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
    setScoreDrafts((prev) => ({ ...prev, ...nextScores }));
    setNotesDrafts((prev) => ({ ...prev, ...nextNotes }));
  }, [competition, adminUserId]);

  useEffect(() => {
    if (!competition) return;
    setFinalistDrafts((prev) => ({
      ...prev,
      [competition.id]: competition.finalists
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((finalist) => finalist.entry_id),
    }));
    setFinalistStatus("idle");
  }, [competition]);

  useEffect(() => {
    const nextPaidPlaces = settings?.final_round_paid_places ?? 3;
    setPaidPlaces(nextPaidPlaces);
    setPrizeDrafts(normalizePrizeDrafts(nextPaidPlaces, settings?.final_round_prizes));
    setPrizeStatus("idle");
  }, [settings?.final_round_paid_places, settings?.final_round_prizes]);

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
  const hasResettableState = competition.scorecards.length > 0 || competition.results.length > 0;
  const uniqueJudgeCount = new Set(competition.scorecards.map((card) => card.judge_id)).size;
  const winnerCandidates = competition.standings.slice(0, paidPlaces);
  const unscoredFinalists = competition.standings.filter((standing) => standing.judge_count === 0);
  const unscoredWinnerCandidates = winnerCandidates.filter((standing) => standing.judge_count === 0);
  const publishBlockedByUnscoredWinners = unscoredWinnerCandidates.length > 0;
  const finalistDraftEntryIds = finalistDrafts[competition.id] ?? competition.finalists.map((finalist) => finalist.entry_id);
  const finalistDraftSet = new Set(finalistDraftEntryIds);
  const entryById = new Map(competition.entries.map((entry) => [entry.id, entry]));
  const finalistDraftEntries = finalistDraftEntryIds
    .map((entryId) => entryById.get(entryId))
    .filter((entry): entry is CompetitionEntry => Boolean(entry));
  const availableEntries = competition.entries.filter((entry) => !finalistDraftSet.has(entry.id));

  const setPaidPlaceCount = (value: number) => {
    const next = Math.min(Math.max(Math.floor(value || 1), 1), MAX_PAID_PLACES);
    setPaidPlaces(next);
    setPrizeDrafts((prev) => normalizePrizeDrafts(next, prev));
    setPrizeStatus("idle");
  };

  const updatePrizeDraft = (placement: number, patch: Partial<HackathonPrize>) => {
    setPrizeDrafts((prev) => normalizePrizeDrafts(paidPlaces, prev).map((prize) => (
      prize.placement === placement ? { ...prize, ...patch } : prize
    )));
    setPrizeStatus("idle");
  };

  const moveFinalistDraft = (entryId: string, direction: -1 | 1) => {
    setFinalistDrafts((prev) => {
      const current = prev[competition.id] ?? finalistDraftEntryIds;
      const index = current.indexOf(entryId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return prev;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return { ...prev, [competition.id]: next };
    });
    setFinalistStatus("idle");
  };

  const addFinalistDraft = (entryId: string) => {
    setFinalistDrafts((prev) => {
      const current = prev[competition.id] ?? finalistDraftEntryIds;
      if (current.includes(entryId)) return prev;
      return { ...prev, [competition.id]: [...current, entryId] };
    });
    setFinalistStatus("idle");
  };

  const removeFinalistDraft = (entryId: string) => {
    const scorecardCount = competition.scorecards.filter((card) => card.entry_id === entryId).length;
    if (scorecardCount > 0 && !confirm("Remove this finalist from the round? Existing scorecards for this project will no longer count in standings.")) {
      return;
    }

    setFinalistDrafts((prev) => {
      const current = prev[competition.id] ?? finalistDraftEntryIds;
      return { ...prev, [competition.id]: current.filter((candidateId) => candidateId !== entryId) };
    });
    setFinalistStatus("idle");
  };

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
        notesDrafts[entryId] ?? "",
        isGuestJudge ? judgeName.trim() || null : null
      );

      if (res.error) {
        setError(res.error);
      } else {
        setSavedEntryId(entryId);
        clearDirty(entryId);
      }
      setActiveEntryId(null);
    });
  };

  const saveFinalistRoster = () => {
    setError(null);
    setFinalistStatus("pending");
    startTransition(async () => {
      const removedScoredFinalists = competition.finalists.filter((finalist) => (
        !finalistDraftSet.has(finalist.entry_id) &&
        competition.scorecards.some((card) => card.entry_id === finalist.entry_id)
      ));

      if (
        removedScoredFinalists.length > 0 &&
        !confirm(`${removedScoredFinalists.length} removed finalist${removedScoredFinalists.length === 1 ? " has" : "s have"} saved scorecards. Save the new roster anyway?`)
      ) {
        setFinalistStatus("idle");
        return;
      }

      const res = await setCompetitionFinalists(competition.id, eventSlug, finalistDraftEntryIds, adminCode);
      if (res.error) {
        setError(res.error);
        setFinalistStatus("idle");
        return;
      }

      setFinalistStatus("saved");
      router.refresh();
    });
  };

  const savePrizeSettings = () => {
    setError(null);
    setPrizeStatus("pending");
    startTransition(async () => {
      const normalizedPrizes = normalizePrizeDrafts(paidPlaces, prizeDrafts);
      const res = await saveFinalRoundPrizeSettings(adminCode, paidPlaces, normalizedPrizes);
      if (res.error) {
        setError(res.error);
        setPrizeStatus("idle");
        return;
      }
      setPrizeDrafts(res.prizes ?? normalizedPrizes);
      setPrizeStatus("saved");
      router.refresh();
    });
  };

  const publishResults = () => {
    setError(null);
    startTransition(async () => {
      const normalizedPrizes = normalizePrizeDrafts(paidPlaces, prizeDrafts);
      const prizeRes = await saveFinalRoundPrizeSettings(adminCode, paidPlaces, normalizedPrizes);
      if (prizeRes.error) {
        setError(prizeRes.error);
        return;
      }

      const res = await publishCompetitionJudgingResults(
        competition.id,
        eventSlug,
        adminCode,
        paidPlaces,
        prizeRes.prizes ?? normalizedPrizes
      );
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const unpublishResults = () => {
    if (!confirm("Hide the current judging winners from attendees?")) return;
    setError(null);
    startTransition(async () => {
      const res = await unpublishCompetitionJudgingResults(competition.id, eventSlug, adminCode);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const resetFinalRound = () => {
    if (!confirm("Reset this Final Round? This clears judge scorecards, aggregate standings, and published winners, but keeps the selected finalists.")) return;
    setError(null);
    setSavedEntryId(null);
    startTransition(async () => {
      const res = await resetCompetitionFinalRound(competition.id, eventSlug, adminCode);
      if (res.error) {
        setError(res.error);
        return;
      }

      clearAllDirty();
      const emptyScores: ScoreDraft = {};
      const emptyNotes: Record<string, string> = {};
      for (const finalist of competition.finalists) {
        emptyScores[finalist.entry_id] = {};
        for (const criterion of competition.criteria) {
          emptyScores[finalist.entry_id][criterion.id] = 0;
        }
        emptyNotes[finalist.entry_id] = "";
      }
      setScoreDrafts(emptyScores);
      setNotesDrafts(emptyNotes);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="relative overflow-hidden rounded-[34px] border border-red-500/30 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="absolute inset-0 bg-grid-red/[0.02] bg-[size:20px_20px]" />
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-red-500/10 blur-[50px]" />
        
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-400">Final Round — Human Judging</p>
            <h3 className="text-2xl font-black tracking-tight text-white mt-1">Score Finalists</h3>
            <p className="text-[12px] font-medium text-gray-400 mt-1">AI pre-screen scores shown above each entry for reference. Add your own scores below.</p>
          </div>
          {competitions.length > 1 ? (
            <select
              value={competition.id}
              onChange={(e) => {
                setSelectedCompetitionId(e.target.value);
                setSavedEntryId(null);
                setError(null);
              }}
              className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[14px] font-bold text-white focus:outline-none focus:border-red-500/50 shadow-inner [&_option]:bg-black [&_option]:text-white"
            >
              {competitions.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-bold text-white shadow-inner">
              {competition.title}
            </div>
          )}
        </div>

        {isGuestJudge && (
          <div className="relative rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-inner">
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Your judge name</label>
            <input
              value={judgeName}
              onChange={(e) => updateJudgeName(e.target.value)}
              placeholder="e.g. Alex (Judge)"
              maxLength={60}
              className="mt-2 w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[14px] font-medium text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 shadow-inner"
            />
            <p className="mt-2 text-[11px] font-medium text-gray-500">
              You&apos;re scoring as a guest judge on this device. Your name labels your scores in the standings; your scorecards stay separate from other judges.
            </p>
          </div>
        )}

        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="rounded-[24px] bg-white/5 border border-white/10 p-5 shadow-inner">
            <p className="text-3xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{competition.finalists.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">Finalists</p>
          </div>
          <div className="rounded-[24px] bg-white/5 border border-white/10 p-5 shadow-inner">
            <p className="text-3xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{competition.criteria.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">Criteria</p>
          </div>
          <div className="rounded-[24px] bg-white/5 border border-white/10 p-5 shadow-inner">
            <p className="text-3xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{maxScore}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">Max Score</p>
          </div>
          <div className={cn(
            "rounded-[24px] border p-5 shadow-inner",
            uniqueJudgeCount > 0 ? "bg-green-500/10 border-green-500/30" : "bg-white/5 border-white/10"
          )}>
            <p className={cn("text-3xl font-black tabular-nums tracking-tight drop-shadow-md", uniqueJudgeCount > 0 ? "text-green-400" : "text-gray-600")}>
              {uniqueJudgeCount}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">Judges Scored</p>
          </div>
        </div>

        {error && (
          <div className="relative rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl space-y-5">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">Finalist Roster</p>
              <h4 className="mt-1 text-xl font-black tracking-tight text-white">Add, remove, and order final-round projects</h4>
              <p className="mt-1 text-[12px] font-medium text-gray-500">Saving this list replaces the active finalists for judging.</p>
            </div>
            <button
              disabled={isPending || finalistStatus === "pending"}
              onClick={saveFinalistRoster}
              className="shrink-0 rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-red-200 transition-colors hover:bg-red-500/25 disabled:opacity-50"
            >
              {finalistStatus === "pending" ? "Saving..." : finalistStatus === "saved" ? "Roster Saved" : "Save Roster"}
            </button>
          </div>

          <div className="relative space-y-3">
            {finalistDraftEntries.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] font-medium text-gray-500">
                No finalists selected. Add projects below to build the final round.
              </p>
            ) : finalistDraftEntries.map((entry, index) => {
              const scorecardCount = competition.scorecards.filter((card) => card.entry_id === entry.id).length;
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-[13px] font-black text-red-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-white">{entry.title}</p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
                      {entry.user?.name ?? "Unknown submitter"} · {scorecardCount} scorecard{scorecardCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      disabled={index === 0}
                      onClick={() => moveFinalistDraft(entry.id, -1)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-gray-300 disabled:opacity-30"
                    >
                      Up
                    </button>
                    <button
                      disabled={index === finalistDraftEntries.length - 1}
                      onClick={() => moveFinalistDraft(entry.id, 1)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-gray-300 disabled:opacity-30"
                    >
                      Down
                    </button>
                    <button
                      onClick={() => removeFinalistDraft(entry.id)}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[11px] font-bold text-orange-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Available Projects</p>
            {availableEntries.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[12px] font-medium text-gray-500">
                Every competition entry is already in the finalist roster.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {availableEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => addFinalistDraft(entry.id)}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-red-400/40 hover:bg-red-500/10"
                  >
                    <p className="truncate text-[12px] font-bold text-white">{entry.title}</p>
                    <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
                      Add to final round
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[34px] border border-yellow-500/25 bg-black/40 p-6 backdrop-blur-xl shadow-2xl space-y-5">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-yellow-500/10 blur-[55px]" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-300">Prize Ladder</p>
              <h4 className="mt-1 text-xl font-black tracking-tight text-white">Paid places and Cursor credits</h4>
              <p className="mt-1 text-[12px] font-medium text-yellow-100/60">These values are snapshotted when winners are published.</p>
            </div>
            <button
              disabled={isPending || prizeStatus === "pending"}
              onClick={savePrizeSettings}
              className="shrink-0 rounded-2xl border border-yellow-400/40 bg-yellow-500/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-yellow-100 transition-colors hover:bg-yellow-500/25 disabled:opacity-50"
            >
              {prizeStatus === "pending" ? "Saving..." : prizeStatus === "saved" ? "Prizes Saved" : "Save Prizes"}
            </button>
          </div>

          <label className="relative block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Paid placements to publish</span>
            <input
              type="number"
              min={1}
              max={MAX_PAID_PLACES}
              value={paidPlaces}
              onChange={(event) => setPaidPlaceCount(Number(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-yellow-400/50"
            />
          </label>

          <div className="relative space-y-3">
            {normalizePrizeDrafts(paidPlaces, prizeDrafts).map((prize) => (
              <div key={prize.placement} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={prize.label}
                    onChange={(event) => updatePrizeDraft(prize.placement, { label: event.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-bold text-white outline-none focus:border-yellow-400/50"
                  />
                  <label className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                    <input
                      type="checkbox"
                      checked={prize.isPublic}
                      onChange={(event) => updatePrizeDraft(prize.placement, { isPublic: event.target.checked })}
                      className="accent-yellow-400"
                    />
                    Public
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Cash value</span>
                    <input
                      type="number"
                      min={0}
                      value={prize.cashValue ?? ""}
                      onChange={(event) => updatePrizeDraft(prize.placement, { cashValue: event.target.value ? Number(event.target.value) : null })}
                      placeholder="0"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-bold text-white outline-none focus:border-yellow-400/50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Cursor credits</span>
                    <input
                      type="number"
                      min={0}
                      value={prize.cursorCredits ?? ""}
                      onChange={(event) => updatePrizeDraft(prize.placement, { cursorCredits: event.target.value ? Number(event.target.value) : null })}
                      placeholder="0"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-bold text-white outline-none focus:border-yellow-400/50"
                    />
                  </label>
                </div>
                <input
                  value={prize.notes ?? ""}
                  onChange={(event) => updatePrizeDraft(prize.placement, { notes: event.target.value })}
                  placeholder="Optional prize note"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-medium text-white outline-none placeholder:text-gray-600 focus:border-yellow-400/50"
                />
                <p className="text-[11px] font-bold text-yellow-100/70">{formatPrizeValue(prize)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {competition.finalists.length === 0 && (
        <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-2xl space-y-3">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
          <p className="relative text-[16px] font-bold text-white">No finalists selected yet.</p>
          <p className="relative text-[13px] font-medium text-gray-400 max-w-md mx-auto leading-relaxed">
            Use the <strong className="text-gray-300">Finalist Roster</strong> controls above to add projects and save the round.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {competition.finalists.map((finalist) => {
          const entry = finalist.entry ?? competition.entries.find((candidate) => candidate.id === finalist.entry_id);
          if (!entry) return null;
          const entryJudgeCount = competition.scorecards.filter((card) => card.entry_id === entry.id).length;
          const isEntryDirty = dirtyEntries.has(entry.id);
          const draftTotal = competition.criteria.reduce(
            (sum, criterion) => sum + Number(scoreDrafts[entry.id]?.[criterion.id] ?? 0),
            0
          );

          return (
            <div key={finalist.id} className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6 transition-all hover:border-white/20 group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-400">
                    Finalist #{finalist.position + 1}
                  </p>
                  <h4 className="text-2xl font-black tracking-tight text-amber-200">{entry.title}</h4>
                  <p className="text-[13px] font-medium text-gray-400">{entry.user?.name ?? "Unknown submitter"}</p>
                  {entry.description && <p className="text-[14px] font-medium text-gray-300 leading-relaxed mt-2 line-clamp-3">{entry.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={entry.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      Repo <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {entry.project_url && (
                      <a
                        href={entry.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-green-400 hover:bg-green-500/10 hover:text-green-300 transition-colors"
                      >
                        Demo <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wider",
                      entryJudgeCount > 0
                        ? "bg-green-500/10 border-green-500/25 text-green-400"
                        : "bg-white/5 border-white/10 text-gray-600"
                    )}>
                      <Users className="w-3 h-3" />
                      {entryJudgeCount} {entryJudgeCount === 1 ? "judge" : "judges"} scored
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1.5">
                  <p className="text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{draftTotal}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">/ {maxScore} pts</p>
                  {isEntryDirty && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500/15 border border-orange-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-orange-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      Unsaved
                    </span>
                  )}
                </div>
              </div>

              {/* AI pre-screen summary */}
              <div className="relative z-10">
                <EntryAISummary repoUrl={entry.repo_url} teams={teams} aiAnalyses={aiAnalyses} />
              </div>

              {/* Human judge scoring */}
              <div className="relative flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Your Judge Score</p>
                <div className="space-y-4">
                  {competition.criteria.map((criterion) => (
                    <div key={criterion.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">{criterion.label}</span>
                        <span className="text-[13px] font-bold tabular-nums text-white">
                          {scoreDrafts[entry.id]?.[criterion.id] ?? 0}/{Number(criterion.max_points)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Number(criterion.max_points)}
                        step={1}
                        value={scoreDrafts[entry.id]?.[criterion.id] ?? 0}
                        onChange={(e) => {
                          markDirty(entry.id);
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [entry.id]: {
                              ...(prev[entry.id] ?? {}),
                              [criterion.id]: Number(e.target.value),
                            },
                          }));
                        }}
                        className="w-full accent-red-500"
                      />
                      {criterion.description && (
                        <p className="text-[11px] font-medium text-gray-500">{criterion.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <textarea
                placeholder="Judge notes..."
                rows={2}
                value={notesDrafts[entry.id] ?? ""}
                onChange={(e) => {
                  markDirty(entry.id);
                  setNotesDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }));
                }}
                className="relative w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[14px] font-medium text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 resize-none transition-colors shadow-inner mt-auto"
              />

              <button
                disabled={isPending || (!adminUserId && !adminCode) || activeEntryId === entry.id}
                onClick={() => saveEntryScore(entry.id)}
                className={cn(
                  "relative w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[13px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 hover:scale-[1.02] shadow-sm mt-2",
                  isEntryDirty
                    ? "bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30"
                    : "bg-white/10 border border-white/10 text-white hover:bg-white/20"
                )}
              >
                <Save className="w-4 h-4" />
                {activeEntryId === entry.id ? "Saving..." : isEntryDirty ? "Save Scorecard" : savedEntryId === entry.id ? "Saved ✓" : "Save Scorecard"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">Aggregate Standings</p>
            <h4 className="text-xl font-black tracking-tight text-white mt-1">Calculated from judge scorecards</h4>
            <p className="mt-1 text-[12px] font-medium text-gray-500">
              Publishing will reveal the top {paidPlaces} paid place{paidPlaces === 1 ? "" : "s"} with the configured prize ladder.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={isPending || !hasResettableState}
              onClick={resetFinalRound}
              className="rounded-[20px] bg-white/5 border border-white/10 px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
            >
              Reset Final Round
            </button>
            {published.length > 0 && (
              <button
                disabled={isPending}
                onClick={unpublishResults}
                className="rounded-[20px] bg-red-500/10 border border-red-500/20 px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                Hide Winners
              </button>
            )}
            <button
              disabled={isPending || competition.standings.length === 0 || publishBlockedByUnscoredWinners}
              onClick={publishResults}
              className="inline-flex items-center gap-2 rounded-[20px] bg-yellow-500/20 border border-yellow-500/30 px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50 transition-all hover:scale-105 shadow-neon"
            >
              <Trophy className="w-4 h-4" />
              Publish Top {paidPlaces}
            </button>
          </div>
        </div>

        {unscoredFinalists.length > 0 && (
          <div className="relative rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-[13px] font-medium text-yellow-200 flex gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
            <div className="space-y-1">
              <p className="font-bold">
                {unscoredFinalists.length} finalist{unscoredFinalists.length === 1 ? "" : "s"} still {unscoredFinalists.length === 1 ? "has" : "have"} no judge scorecards.
              </p>
              <p className="text-yellow-100/80">
                {publishBlockedByUnscoredWinners
                  ? `Publishing is blocked because at least one Top ${paidPlaces} candidate has no saved scorecard.`
                  : "They will remain at 0 points unless a judge saves a scorecard before publishing."}
              </p>
            </div>
          </div>
        )}

        {competition.standings.length === 0 ? (
          <p className="relative text-[14px] font-medium text-gray-500">No standings yet. Select finalists and save at least one scorecard.</p>
        ) : (
          <div className="relative space-y-3">
            {competition.standings.map((standing) => (
              <div
                key={standing.entry_id}
                className={cn(
                  "rounded-[24px] border p-5 flex items-center gap-5 transition-all hover:scale-[1.01]",
                  standing.placement === 1
                    ? "border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                    : "border-white/10 bg-white/5"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-[18px] font-black shadow-inner",
                  standing.placement === 1 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-neon" :
                  standing.placement === 2 ? "bg-gray-400/10 text-gray-300 border border-gray-400/20" :
                  standing.placement === 3 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                  "bg-white/10 text-gray-400"
                )}>
                  {standing.placement <= 3 ? <Medal className="w-5 h-5" /> : standing.placement}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-white tracking-tight truncate">{standing.entry.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/15 border border-green-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-green-400">
                      <Users className="w-2.5 h-2.5" />
                      {standing.judge_count} {standing.judge_count === 1 ? "judge" : "judges"}
                    </span>
                    {standing.placement <= paidPlaces && (
                      <span className="inline-flex rounded-lg bg-yellow-500/15 border border-yellow-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-200">
                        {formatPrizeValue(normalizePrizeDrafts(paidPlaces, prizeDrafts).find((prize) => prize.placement === standing.placement))}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-black tabular-nums tracking-tight text-white drop-shadow-md">
                  {formatScore(standing.final_score, standing.max_score)}
                </p>
              </div>
            ))}
          </div>
        )}

        {published.length > 0 && (
          <div className="relative rounded-[20px] bg-green-500/10 border border-green-500/20 p-5 text-[14px] font-bold text-green-400 flex items-center gap-3 shadow-neon-green">
            <Users className="w-5 h-5" />
            Winners are published to attendees.
          </div>
        )}
      </div>
    </div>
  );
}
