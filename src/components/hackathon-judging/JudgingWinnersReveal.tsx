"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Trophy, Medal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WinnerCelebration } from "@/components/competitions/Confetti";
import { cn } from "@/lib/utils";
import type { CompetitionJudgingResult } from "@/types";

interface Props {
  eventId: string;
  initialResults: CompetitionJudgingResult[];
}

function groupKey(results: CompetitionJudgingResult[]) {
  const first = results[0];
  return first ? `${first.competition_id}:${first.published_at ?? first.created_at}` : "";
}

function groupLatestResults(results: CompetitionJudgingResult[]) {
  const publishedGroups = new Map<string, CompetitionJudgingResult[]>();
  for (const result of results.filter((row) => row.is_published)) {
    const key = `${result.competition_id}:${result.published_at ?? result.created_at}`;
    const existing = publishedGroups.get(key) ?? [];
    existing.push(result);
    publishedGroups.set(key, existing);
  }

  return Array.from(publishedGroups.values())
    .sort((a, b) => {
      const bTime = new Date(b[0]?.published_at ?? b[0]?.created_at ?? 0).getTime();
      const aTime = new Date(a[0]?.published_at ?? a[0]?.created_at ?? 0).getTime();
      return bTime - aTime;
    })
    .map((group) => group.sort((a, b) => a.placement - b.placement))[0] ?? [];
}

export function JudgingWinnersReveal({ eventId, initialResults }: Props) {
  const [results, setResults] = useState(initialResults);
  const [activeResults, setActiveResults] = useState<CompetitionJudgingResult[]>([]);

  const latestResults = useMemo(() => groupLatestResults(results), [results]);

  useEffect(() => {
    const key = groupKey(latestResults);
    if (!key || window.localStorage.getItem(`judging-reveal:${key}`)) return;
    setActiveResults(latestResults);
    window.localStorage.setItem(`judging-reveal:${key}`, "seen");
  }, [latestResults]);

  useEffect(() => {
    const supabase = createClient();

    const fetchCompetitionResults = async (competitionId: string) => {
      const { data } = await supabase
        .from("competition_judging_results")
        .select(`
          *,
          entry:competition_entries!competition_judging_results_entry_id_fkey(*, user:users(id, name, email)),
          competition:competitions!competition_judging_results_competition_id_fkey(id, title)
        `)
        .eq("event_id", eventId)
        .eq("competition_id", competitionId)
        .eq("is_published", true)
        .order("placement", { ascending: true });

      if (!data?.length) return;
      const next = data as unknown as CompetitionJudgingResult[];
      setResults((prev) => [
        ...prev.filter((result) => result.competition_id !== competitionId),
        ...next,
      ]);
      const key = groupKey(next);
      if (!window.localStorage.getItem(`judging-reveal:${key}`)) {
        setActiveResults(next);
        window.localStorage.setItem(`judging-reveal:${key}`, "seen");
      }
    };

    const channel = supabase
      .channel(`competition-judging-results-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "competition_judging_results", filter: `event_id=eq.${eventId}` },
        (payload) => fetchCompetitionResults(payload.new.competition_id as string)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "competition_judging_results", filter: `event_id=eq.${eventId}` },
        (payload) => fetchCompetitionResults(payload.new.competition_id as string)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (activeResults.length === 0) return null;

  const competitionTitle = activeResults[0]?.competition?.title ?? "Hackathon";
  const winner = activeResults.find((result) => result.placement === 1) ?? activeResults[0];

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <WinnerCelebration duration={20000} />
      </div>

      <div className="relative w-full max-w-3xl glass rounded-[40px] border border-yellow-400/30 p-8 md:p-10 overflow-hidden shadow-2xl">
        <button
          onClick={() => setActiveResults([])}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-gray-300 hover:text-white hover:bg-white/20"
          aria-label="Close winners reveal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-yellow-300" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-yellow-300">Winners Announced</p>
          <h2 className="text-3xl md:text-5xl font-light text-white">{competitionTitle}</h2>
          {winner?.entry && (
            <p className="text-lg text-white/80">
              Congratulations to <span className="text-yellow-200">{winner.entry.title}</span>
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3 md:items-end">
          {[2, 1, 3].map((placement) => {
            const result = activeResults.find((row) => row.placement === placement);
            if (!result) return <div key={placement} className="hidden md:block" />;
            return (
              <div
                key={result.id}
                className={cn(
                  "rounded-[28px] border p-5 text-center bg-white/5",
                  placement === 1
                    ? "md:order-2 border-yellow-400/40 bg-yellow-400/10 md:pb-10"
                    : placement === 2
                      ? "md:order-1 border-white/20 md:pb-6"
                      : "md:order-3 border-orange-400/30 bg-orange-400/5 md:pb-4"
                )}
              >
                <Medal className={cn(
                  "w-6 h-6 mx-auto mb-3",
                  placement === 1 ? "text-yellow-300" : placement === 2 ? "text-gray-300" : "text-orange-300"
                )} />
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                  Place {placement}
                </p>
                <h3 className="text-lg font-medium text-white mt-2">{result.entry?.title ?? "Project"}</h3>
                <p className="text-xs text-gray-500 mt-1">{result.entry?.user?.name ?? "Team"}</p>
                <p className="text-sm tabular-nums text-white/70 mt-3">
                  {Number(result.final_score).toFixed(1)} / {Number(result.max_score).toFixed(0)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function JudgingWinnersPodium({ results }: { results: CompetitionJudgingResult[] }) {
  const latestResults = groupLatestResults(results);
  if (latestResults.length === 0) return null;

  const competitionTitle = latestResults[0]?.competition?.title ?? "Hackathon";

  return (
    <div className="glass rounded-[32px] p-6 border border-yellow-400/20 bg-yellow-400/5 space-y-5">
      <div className="flex items-center gap-3">
        <Trophy className="w-5 h-5 text-yellow-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-300">Published Winners</p>
          <h2 className="text-xl font-light text-white">{competitionTitle}</h2>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {latestResults.slice(0, 3).map((result) => (
          <div key={result.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Place {result.placement}</p>
            <p className="text-sm text-white mt-2">{result.entry?.title ?? "Project"}</p>
            <p className="text-xs text-gray-500 mt-1">{result.entry?.user?.name ?? "Team"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
