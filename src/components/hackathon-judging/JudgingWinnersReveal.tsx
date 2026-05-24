"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Trophy, Medal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WinnerCelebration } from "@/components/competitions/Confetti";
import { TeamIcon } from "@/components/hackathon/TeamIcon";
import { cn } from "@/lib/utils";
import type { CompetitionEntry, CompetitionJudgingResult, EventPhoto } from "@/types";

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

function resultTeamLabel(result: CompetitionJudgingResult) {
  return result.entry?.team?.name ?? result.entry?.user?.name ?? "Team";
}

async function attachResultTeams(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  results: CompetitionJudgingResult[]
): Promise<CompetitionJudgingResult[]> {
  const userIds = Array.from(
    new Set(results.map((result) => result.entry?.user_id).filter((id): id is string => Boolean(id)))
  );
  if (userIds.length === 0) return results;

  const { data: teamMembers } = await supabase
    .from("hackathon_team_members")
    .select("user_id, team:hackathon_teams!hackathon_team_members_team_id_fkey(id, name, icon_photo_id, event_id)")
    .in("user_id", userIds)
    .eq("hackathon_teams.event_id", eventId);

  type RawTeam = { id: string; name: string; icon_photo_id: string | null; event_id: string };
  type RawTeamMember = { user_id: string; team: RawTeam | RawTeam[] | null };

  const normalizedMembers = (teamMembers ?? []) as RawTeamMember[];
  const iconPhotoIds = normalizedMembers
    .map((member) => {
      const team = Array.isArray(member.team) ? member.team[0] : member.team;
      return team?.icon_photo_id;
    })
    .filter((id): id is string => Boolean(id));

  const { data: photos } = iconPhotoIds.length
    ? await supabase
        .from("event_photos")
        .select("*")
        .in("id", iconPhotoIds)
        .eq("status", "approved")
    : { data: [] };
  const photosById = new Map((photos ?? []).map((photo) => [photo.id, photo as EventPhoto]));

  const teamByUserId = new Map<string, NonNullable<CompetitionEntry["team"]>>();
  for (const member of normalizedMembers) {
    const team = Array.isArray(member.team) ? member.team[0] : member.team;
    if (!team) continue;
    teamByUserId.set(member.user_id, {
      id: team.id,
      name: team.name,
      icon_photo: team.icon_photo_id ? photosById.get(team.icon_photo_id) ?? null : null,
    });
  }

  return results.map((result) => ({
    ...result,
    entry: result.entry
      ? {
          ...result.entry,
          team: teamByUserId.get(result.entry.user_id) ?? result.entry.team ?? null,
        }
      : result.entry,
  }));
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

      const next = await attachResultTeams(supabase, eventId, data as unknown as CompetitionJudgingResult[]);
      setResults((prev) => [
        ...prev.filter((result) => result.competition_id !== competitionId),
        ...next,
      ]);
      if (next.length === 0) {
        setActiveResults((prev) => prev.some((result) => result.competition_id === competitionId) ? [] : prev);
        return;
      }
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
  const podiumPlacements = activeResults.length === 1 ? [winner.placement] : [2, 1, 3];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 transition-opacity">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
        <WinnerCelebration duration={20000} />
      </div>

      <div className="relative w-full max-w-4xl overflow-hidden rounded-[40px] border border-yellow-500/40 bg-black/80 p-8 md:p-12 shadow-[0_0_100px_rgba(234,179,8,0.2)] backdrop-blur-2xl">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-yellow-500/20 blur-[100px]" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-orange-500/20 blur-[100px]" />

        <button
          onClick={() => setActiveResults([])}
          className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all hover:scale-110 z-10"
          aria-label="Close winners reveal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative text-center space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-yellow-500/40 bg-white shadow-[0_0_40px_rgba(234,179,8,0.5)] relative overflow-hidden">
            <div className="absolute inset-0 bg-yellow-500/10 animate-pulse" />
            <img src="/trophy.jpeg" alt="Trophy" className="w-full h-full object-cover relative z-10 scale-[1.15]" style={{ mixBlendMode: 'multiply' }} />
          </div>
          <div className="space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.4em] text-yellow-400/90">Winners Announced</p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-2xl">{competitionTitle}</h2>
          </div>
          {winner?.entry && (
            <p className="text-xl font-medium text-gray-300 mt-4">
              Congratulations to <span className="font-bold text-yellow-400 drop-shadow-md">{winner.entry.title}</span>
            </p>
          )}
        </div>

        <div className={cn(
          "relative mt-12 grid gap-4 md:items-end",
          activeResults.length === 1 ? "mx-auto w-full max-w-xs md:grid-cols-1" : "md:grid-cols-3"
        )}>
          {podiumPlacements.map((placement) => {
            const result = activeResults.find((row) => row.placement === placement);
            if (!result) {
              return (
                <div
                  key={placement}
                  className={cn(
                    "hidden md:block",
                    placement === 1 ? "md:order-2" : placement === 2 ? "md:order-1" : "md:order-3"
                  )}
                />
              );
            }
            return (
              <div
                key={result.id}
                className={cn(
                  "relative overflow-hidden rounded-[32px] border p-6 text-center backdrop-blur-md transition-transform hover:scale-105",
                  placement === 1
                    ? "md:order-2 border-yellow-500/50 bg-yellow-500/10 md:pb-12 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
                    : placement === 2
                      ? "md:order-1 border-gray-400/40 bg-gray-400/10 md:pb-8 shadow-[0_0_20px_rgba(156,163,175,0.1)]"
                      : "md:order-3 border-orange-500/40 bg-orange-500/10 md:pb-6 shadow-[0_0_20px_rgba(249,115,22,0.1)]"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent" />
                <div className="relative">
                  <div className="relative mx-auto mb-5 w-fit">
                    <TeamIcon
                      photo={result.entry?.team?.icon_photo}
                      name={resultTeamLabel(result)}
                      className={cn(
                        "rounded-[24px] border-white/15 shadow-xl",
                        placement === 1 ? "h-24 w-24" : "h-20 w-20"
                      )}
                      fallbackClassName={placement === 1 ? "opacity-25" : "opacity-20"}
                      sizes={placement === 1 ? "96px" : "80px"}
                    />
                    <div className={cn(
                      "absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border bg-black/80 shadow-lg",
                      placement === 1 ? "border-yellow-500/50" : placement === 2 ? "border-gray-400/40" : "border-orange-500/40"
                    )}>
                      <Medal className={cn(
                        "h-5 w-5 drop-shadow-lg",
                        placement === 1 ? "text-yellow-400" : placement === 2 ? "text-gray-300" : "text-orange-400"
                      )} />
                    </div>
                  </div>
                  <p className={cn(
                    "text-[11px] font-bold uppercase tracking-[0.3em]",
                    placement === 1 ? "text-yellow-500/80" : placement === 2 ? "text-gray-400/80" : "text-orange-500/80"
                  )}>
                    Place {placement}
                  </p>
                  <h3 className="text-2xl font-black tracking-tight text-white mt-2">{result.entry?.title ?? "Project"}</h3>
                  <p className="text-[13px] font-medium text-gray-300 mt-1">{resultTeamLabel(result)}</p>
                  <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 border border-white/10">
                    <span className="text-[15px] font-bold text-white">{Number(result.final_score).toFixed(1)}</span>
                    <span className="text-[11px] font-bold text-gray-500">/ {Number(result.max_score).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function groupAllPublishedResults(results: CompetitionJudgingResult[]) {
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
    .map((group) => group.sort((a, b) => a.placement - b.placement));
}

export function JudgingWinnersPodium({ results }: { results: CompetitionJudgingResult[] }) {
  const allGroups = groupAllPublishedResults(results);
  if (allGroups.length === 0) return null;

  return (
    <div className="space-y-6">
      {allGroups.map((group) => {
        const competitionTitle = group[0]?.competition?.title ?? "Hackathon";
        const key = `${group[0]?.competition_id}:${group[0]?.published_at ?? group[0]?.created_at}`;

        return (
          <div key={key} className="relative overflow-hidden rounded-[34px] border border-yellow-500/30 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-yellow-500/10 blur-[50px]" />
            
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/40 bg-white text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.4)] relative overflow-hidden">
                <div className="absolute inset-0 bg-yellow-500/10 animate-pulse" />
                <img src="/trophy.jpeg" alt="Trophy" className="w-full h-full object-cover relative z-10 scale-[1.15]" style={{ mixBlendMode: 'multiply' }} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-400/80">Published Winners</p>
                <h2 className="text-2xl font-black tracking-tight text-white">{competitionTitle}</h2>
              </div>
            </div>
            <div className="relative grid gap-4 sm:grid-cols-3">
              {group.slice(0, 3).map((result) => (
                <div key={result.id} className={cn(
                  "rounded-[24px] border p-5 transition-all hover:scale-[1.02]",
                  result.placement === 1 ? "border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)]" :
                  result.placement === 2 ? "border-gray-400/30 bg-gray-400/10" :
                  "border-orange-500/30 bg-orange-500/10"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.2em]",
                      result.placement === 1 ? "text-yellow-400" :
                      result.placement === 2 ? "text-gray-400" :
                      "text-orange-400"
                    )}>Place {result.placement}</p>
                    <Medal className={cn(
                      "w-4 h-4",
                      result.placement === 1 ? "text-yellow-400" :
                      result.placement === 2 ? "text-gray-400" :
                      "text-orange-400"
                    )} />
                  </div>
                  <div className="flex items-center gap-3">
                    <TeamIcon
                      photo={result.entry?.team?.icon_photo}
                      name={resultTeamLabel(result)}
                      className="h-11 w-11 rounded-xl border-white/10"
                      fallbackClassName="opacity-20"
                      sizes="44px"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-white">{result.entry?.title ?? "Project"}</p>
                      <p className="mt-1 truncate text-[12px] font-medium text-gray-400">{resultTeamLabel(result)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
