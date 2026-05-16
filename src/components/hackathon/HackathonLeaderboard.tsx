"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Event, HackathonSettings, HackathonTeamWithMembers, HackathonScore } from "@/types";
import { HACKATHON_SCORE_MAX, calculateAverageHackathonWeightedScore } from "@/lib/hackathon-rubric";

interface Props {
  event: Event;
  initialSettings: HackathonSettings | null;
  initialTeams: HackathonTeamWithMembers[];
  initialScores: HackathonScore[];
}

function teamTotal(teamId: string, scores: HackathonScore[]): number {
  const rows = scores.filter((s) => s.team_id === teamId);
  return calculateAverageHackathonWeightedScore(rows);
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{time}</span>;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const RANK_STYLES = [
  "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.2)]",
  "border-gray-400/30 bg-gray-400/5 shadow-[0_0_20px_rgba(156,163,175,0.1)]",
  "border-orange-500/30 bg-orange-500/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]",
];
const SCORE_STYLES = [
  "text-yellow-300",
  "text-gray-200",
  "text-orange-300",
];

export function HackathonLeaderboard({ event, initialSettings, initialTeams, initialScores }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [teams, setTeams] = useState(initialTeams);
  const [scores, setScores] = useState(initialScores);

  const refresh = useCallback(() => router.refresh(), [router]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`hackathon-leaderboard-${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_settings", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_teams", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_team_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_scores", filter: `event_id=eq.${event.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [event.id, refresh]);

  // Sync server-refreshed props
  useEffect(() => { setSettings(initialSettings); }, [initialSettings]);
  useEffect(() => { setTeams(initialTeams); }, [initialTeams]);
  useEffect(() => { setScores(initialScores); }, [initialScores]);

  const ranked = useMemo(() => {
    return [...teams]
      .filter((t) => scores.some((s) => s.team_id === t.id))
      .map((t) => ({ team: t, total: teamTotal(t.id, scores) }))
      .sort((a, b) => b.total - a.total);
  }, [teams, scores]);

  const maxScore = HACKATHON_SCORE_MAX;

  // ── Holding screen ────────────────────────────────────────────────────────
  if (!settings?.leaderboard_visible) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15)_0,transparent_70%)]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />

        <div className="relative flex flex-col items-center gap-8 text-center px-8">
          <img src="/cursor-logo.svg" alt="Cursor" className="w-16 h-16 drop-shadow-[0_0_24px_rgba(255,255,255,0.6)] brightness-200 animate-pulse" />
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-red-400 mb-3">Cursor Hackathon</p>
            <h1 className="text-6xl font-black tracking-tight text-white mb-4">{event.name}</h1>
          </div>
          <div className="flex items-center gap-3 text-red-400/80">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <p className="text-[18px] font-bold uppercase tracking-[0.3em]">Judging in progress</p>
          </div>
          <p className="text-gray-600 text-[13px] font-bold uppercase tracking-[0.3em] mt-8">
            <Clock />
          </p>
        </div>
      </div>
    );
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.12)_0,transparent_60%)]" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-10 py-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
            <img src="/cursor-logo.svg" alt="Cursor" className="w-6 h-6 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] brightness-200" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-400">Cursor Hackathon</p>
            <h1 className="text-[22px] font-black tracking-tight text-white leading-tight">{event.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600">Live Scores</p>
            <p className="text-[13px] font-bold text-gray-400"><Clock /></p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-400">Live</span>
          </div>
        </div>
      </header>

      {/* Rankings */}
      <main className="relative z-10 flex-1 overflow-y-auto px-10 py-8">
        {ranked.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[20px] font-bold text-gray-600 uppercase tracking-widest">No scores yet</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {ranked.map(({ team, total }, i) => {
              const pct = maxScore > 0 ? (total / maxScore) * 100 : 0;
              const isTop3 = i < 3;

              return (
                <div
                  key={team.id}
                  className={cn(
                    "relative overflow-hidden rounded-[28px] border p-6 transition-all",
                    isTop3 ? RANK_STYLES[i] : "border-white/8 bg-white/[0.03]"
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {i === 0 && (
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-yellow-500/15 blur-[50px] pointer-events-none" />
                  )}

                  <div className="relative flex items-center gap-6">
                    {/* Rank */}
                    <div className="shrink-0 w-16 text-center">
                      {isTop3 ? (
                        <span className="text-4xl">{MEDALS[i]}</span>
                      ) : (
                        <span className={cn(
                          "text-3xl font-black tabular-nums",
                          i < 6 ? "text-gray-300" : "text-gray-600"
                        )}>
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Team info */}
                    <div className="flex-1 min-w-0">
                      <h2 className={cn(
                        "font-black tracking-tight truncate",
                        isTop3 ? "text-4xl text-white" : "text-2xl text-gray-200"
                      )}>
                        {team.name}
                      </h2>
                      <p className="text-[13px] font-medium text-gray-500 mt-1 truncate">
                        {team.members.map((m) => m.user?.name ?? "?").join("  ·  ")}
                      </p>

                      {/* Score bar */}
                      <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden w-full max-w-md">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            i === 0 ? "bg-gradient-to-r from-yellow-500 to-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.6)]" :
                            i === 1 ? "bg-gradient-to-r from-gray-400 to-gray-200" :
                            i === 2 ? "bg-gradient-to-r from-orange-500 to-orange-300" :
                            "bg-gradient-to-r from-red-600 to-red-400"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <div className="shrink-0 text-right">
                      <p className={cn(
                        "font-black tabular-nums leading-none",
                        isTop3 ? `text-6xl ${SCORE_STYLES[i]}` : "text-4xl text-gray-400"
                      )}>
                        {total}
                      </p>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600 mt-1">
                        / {maxScore} pts
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-10 py-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-700">
          Powered by Cursor · New Era AI
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-700">
          {ranked.length} team{ranked.length !== 1 ? "s" : ""} scored
        </p>
      </footer>
    </div>
  );
}
