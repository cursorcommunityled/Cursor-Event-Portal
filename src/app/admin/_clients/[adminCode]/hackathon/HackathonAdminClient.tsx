"use client";

import { useState, useTransition } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  toggleHackathonMode,
  toggleTeamFormation,
  saveHackathonSettings,
  toggleLeaderboard,
  adminSetTeamLock,
  saveHackathonScore,
  adminRemoveTeamMember,
} from "@/lib/actions/hackathon";
import {
  Swords, Settings, Users, Trophy, BarChart3,
  Lock, Unlock, ArrowLeft, Check, X, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Event, HackathonSettings, HackathonTeamWithMembers, HackathonScore } from "@/types";

interface Props {
  event: Event;
  adminCode: string;
  initialSettings: HackathonSettings | null;
  initialTeams: HackathonTeamWithMembers[];
  initialScores: HackathonScore[];
}

type Tab = "settings" | "teams" | "scoring" | "leaderboard";

const SCORE_CATEGORIES = [
  { key: "innovation" as const, label: "Innovation" },
  { key: "execution" as const, label: "Execution" },
  { key: "presentation" as const, label: "Presentation" },
  { key: "ux_polish" as const, label: "UX / Polish" },
];

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
}

export function HackathonAdminClient({ event, adminCode, initialSettings, initialTeams, initialScores }: Props) {
  const [tab, setTab] = useState<Tab>("settings");
  const [isPending, startTransition] = useTransition();
  const [isHackathon, setIsHackathon] = useState(event.is_hackathon);
  const [settings, setSettings] = useState(initialSettings);
  const [teams, setTeams] = useState(initialTeams);
  const [scores, setScores] = useState(initialScores);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Settings form state
  const [teamFormationEnabled, setTeamFormationEnabled] = useState(
    initialSettings?.team_formation_enabled ?? true
  );
  const [formOpens, setFormOpens] = useState(fmt(initialSettings?.team_formation_opens_at));
  const [formCloses, setFormCloses] = useState(fmt(initialSettings?.team_formation_closes_at));
  const [formSubmission, setFormSubmission] = useState(fmt(initialSettings?.submission_deadline));
  const [formJudging, setFormJudging] = useState(fmt(initialSettings?.judging_starts_at));
  const [formMinSize, setFormMinSize] = useState(initialSettings?.min_team_size ?? 2);
  const [formMaxSize, setFormMaxSize] = useState(initialSettings?.max_team_size ?? 4);

  // Scoring state: { [teamId]: { [category]: score } }
  const [scoreInputs, setScoreInputs] = useState<Record<string, Record<string, number | null>>>(() => {
    const init: Record<string, Record<string, number | null>> = {};
    for (const team of initialTeams) {
      const teamScores = initialScores.filter((s) => s.team_id === team.id);
      const merged: Record<string, number | null> = {};
      for (const s of teamScores) {
        for (const cat of SCORE_CATEGORIES) {
          if (s[cat.key] != null) merged[cat.key] = s[cat.key];
        }
      }
      init[team.id] = merged;
    }
    return init;
  });
  const [scoreNotes, setScoreNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of initialScores) init[s.team_id] = s.notes ?? "";
    return init;
  });

  const showFeedback = (err?: string) => {
    if (err) { setError(err); return; }
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  function totalScore(teamId: string): number {
    const cats = scoreInputs[teamId] ?? {};
    return SCORE_CATEGORIES.reduce((sum, c) => sum + (cats[c.key] ?? 0), 0);
  }

  const rankedTeams = [...teams].sort((a, b) => totalScore(b.id) - totalScore(a.id));

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
    { id: "teams", label: `Teams (${teams.length})`, icon: <Users className="w-4 h-4" /> },
    { id: "scoring", label: "Scoring", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader adminCode={adminCode} title="Hackathon" subtitle="Control Center" showBackArrow={false} />

      <main className="max-w-4xl mx-auto px-6 py-8 pb-16 w-full z-10 flex-1 space-y-6">

        <div className="flex items-center gap-3 animate-slide-up">
          <Link href={`/admin/${adminCode}`} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-gray-700">/</span>
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/70">Hackathon</span>
          </div>
        </div>

        {/* Hackathon mode toggle */}
        <div className="glass rounded-[32px] p-6 border-white/20 animate-slide-up flex items-center justify-between">
          <div>
            <h3 className="text-lg font-light">Hackathon Mode</h3>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mt-1">
              {isHackathon ? "Active — hackathon nav visible to attendees" : "Inactive — hidden from attendees"}
            </p>
          </div>
          <button
            disabled={isPending}
            onClick={() => startTransition(async () => {
              const newVal = !isHackathon;
              const res = await toggleHackathonMode(adminCode, newVal);
              if (res.success) setIsHackathon(newVal);
              else setError(res.error ?? "Failed");
            })}
            className={cn(
              "relative w-14 h-7 rounded-full border transition-all duration-200",
              isHackathon
                ? "bg-purple-500/40 border-purple-400/60"
                : "bg-white/5 border-white/10"
            )}
          >
            <div className={cn(
              "absolute top-1 w-5 h-5 rounded-full transition-all duration-200",
              isHackathon ? "left-8 bg-purple-400" : "left-1 bg-gray-600"
            )} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="glass rounded-[24px] p-2 flex gap-2 animate-slide-up">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[16px] text-xs font-medium uppercase tracking-[0.15em] transition-all duration-200",
                tab === t.id
                  ? "bg-white text-black shadow-glow"
                  : "text-gray-500 hover:text-white"
              )}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Feedback */}
        {error && (
          <div className="glass rounded-2xl p-4 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="glass rounded-2xl p-4 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Saved
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="glass rounded-[32px] p-8 border-white/20 space-y-6 animate-slide-up">

            {/* Manual team formation toggle — primary control */}
            <div className={cn(
              "rounded-2xl p-5 border flex items-center justify-between gap-4 transition-all",
              teamFormationEnabled
                ? "border-green-500/30 bg-green-500/5"
                : "border-red-500/30 bg-red-500/5"
            )}>
              <div>
                <p className="text-sm font-medium">
                  {teamFormationEnabled ? "Team Formation Open" : "Team Formation Closed"}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
                  {teamFormationEnabled
                    ? "Attendees can form & join teams"
                    : "Manually locked — attendees cannot change teams"}
                </p>
              </div>
              <button
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  const newVal = !teamFormationEnabled;
                  const res = await toggleTeamFormation(adminCode, newVal);
                  if (res.success) setTeamFormationEnabled(newVal);
                  else setError(res.error ?? "Failed");
                })}
                className={cn(
                  "relative w-14 h-7 rounded-full border transition-all duration-200 shrink-0",
                  teamFormationEnabled
                    ? "bg-green-500/40 border-green-400/60"
                    : "bg-red-500/20 border-red-500/30"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-5 h-5 rounded-full transition-all duration-200",
                  teamFormationEnabled ? "left-8 bg-green-400" : "left-1 bg-red-400"
                )} />
              </button>
            </div>

            <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-400">Team Formation Window (Optional Timer)</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Opens At</span>
                <input
                  type="datetime-local"
                  value={formOpens}
                  onChange={(e) => setFormOpens(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Closes At (Team Lock)</span>
                <input
                  type="datetime-local"
                  value={formCloses}
                  onChange={(e) => setFormCloses(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Submission Deadline</span>
                <input
                  type="datetime-local"
                  value={formSubmission}
                  onChange={(e) => setFormSubmission(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Judging Starts</span>
                <input
                  type="datetime-local"
                  value={formJudging}
                  onChange={(e) => setFormJudging(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </label>
            </div>

            <div className="border-t border-white/5 pt-6">
              <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-400 mb-4">Team Size</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Min Members</span>
                  <input
                    type="number"
                    min={1}
                    max={formMaxSize}
                    value={formMinSize}
                    onChange={(e) => setFormMinSize(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Max Members</span>
                  <input
                    type="number"
                    min={formMinSize}
                    max={10}
                    value={formMaxSize}
                    onChange={(e) => setFormMaxSize(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </label>
              </div>
            </div>

            <button
              disabled={isPending}
              onClick={() => startTransition(async () => {
                const res = await saveHackathonSettings(adminCode, {
                  team_formation_enabled: teamFormationEnabled,
                  team_formation_opens_at: formOpens || null,
                  team_formation_closes_at: formCloses || null,
                  submission_deadline: formSubmission || null,
                  judging_starts_at: formJudging || null,
                  min_team_size: formMinSize,
                  max_team_size: formMaxSize,
                });
                showFeedback(res.error);
              })}
              className="w-full py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-50"
            >
              Save Settings
            </button>
          </div>
        )}

        {/* Teams tab */}
        {tab === "teams" && (
          <div className="space-y-4 animate-slide-up">
            {teams.length === 0 && (
              <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
                No teams formed yet
              </div>
            )}
            {teams.map((team) => (
              <div key={team.id} className="glass rounded-[28px] p-6 border-white/20 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-light">{team.name}</h3>
                      {team.locked_at && (
                        <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                      {team.project?.submitted_at && (
                        <span className="text-[9px] uppercase tracking-[0.2em] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">
                          Project Submitted
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
                      {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(async () => {
                      const res = await adminSetTeamLock(adminCode, team.id, !team.locked_at);
                      if (res.success) {
                        setTeams((prev) => prev.map((t) =>
                          t.id === team.id
                            ? { ...t, locked_at: t.locked_at ? null : new Date().toISOString() }
                            : t
                        ));
                      } else setError(res.error ?? "Failed");
                    })}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs border transition-all",
                      team.locked_at
                        ? "border-amber-400/30 text-amber-400 hover:bg-amber-400/10"
                        : "border-white/10 text-gray-400 hover:text-white hover:border-white/30"
                    )}
                  >
                    {team.locked_at ? <><Unlock className="w-3 h-3" /> Unlock</> : <><Lock className="w-3 h-3" /> Lock</>}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {team.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                      <span className="text-sm">{m.user?.name ?? "Unknown"}</span>
                      {m.role === "leader" && (
                        <span className="text-[8px] uppercase tracking-[0.2em] text-purple-400">Leader</span>
                      )}
                      <button
                        onClick={() => startTransition(async () => {
                          if (!confirm(`Remove ${m.user?.name} from ${team.name}?`)) return;
                          const res = await adminRemoveTeamMember(adminCode, team.id, m.user_id);
                          if (res.success) {
                            setTeams((prev) => prev.map((t) =>
                              t.id === team.id
                                ? { ...t, members: t.members.filter((mem) => mem.id !== m.id) }
                                : t
                            ).filter((t) => t.members.length > 0));
                          } else setError(res.error ?? "Failed");
                        })}
                        className="text-gray-600 hover:text-red-400 transition-colors ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {team.project && (
                  <div className="border-t border-white/5 pt-4 space-y-1">
                    <p className="text-xs font-medium text-white/80">{team.project.name}</p>
                    {team.project.description && (
                      <p className="text-xs text-gray-400">{team.project.description}</p>
                    )}
                    <div className="flex gap-4 mt-2">
                      {team.project.repo_url && (
                        <a href={team.project.repo_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] uppercase tracking-[0.15em] text-blue-400 hover:text-blue-300">
                          Repo →
                        </a>
                      )}
                      {team.project.demo_url && (
                        <a href={team.project.demo_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] uppercase tracking-[0.15em] text-green-400 hover:text-green-300">
                          Demo →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scoring tab */}
        {tab === "scoring" && (
          <div className="space-y-4 animate-slide-up">
            {teams.length === 0 && (
              <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
                No teams to score yet
              </div>
            )}
            {teams.map((team) => (
              <div key={team.id} className="glass rounded-[28px] p-6 border-white/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-light">{team.name}</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                      {team.members.map((m) => m.user?.name).join(" · ")}
                    </p>
                  </div>
                  <div className="text-3xl font-light tabular-nums text-white/60">
                    {totalScore(team.id)}<span className="text-sm text-gray-600">/40</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {SCORE_CATEGORIES.map((cat) => (
                    <div key={cat.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{cat.label}</span>
                        <span className="text-xs tabular-nums text-white/60">
                          {scoreInputs[team.id]?.[cat.key] ?? "—"}/10
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={scoreInputs[team.id]?.[cat.key] ?? 0}
                        onChange={(e) => setScoreInputs((prev) => ({
                          ...prev,
                          [team.id]: { ...(prev[team.id] ?? {}), [cat.key]: Number(e.target.value) },
                        }))}
                        className="w-full accent-white"
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  placeholder="Judge notes..."
                  rows={2}
                  value={scoreNotes[team.id] ?? ""}
                  onChange={(e) => setScoreNotes((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
                />

                <button
                  disabled={isPending}
                  onClick={() => startTransition(async () => {
                    const cats = scoreInputs[team.id] ?? {};
                    const res = await saveHackathonScore(adminCode, team.id, {
                      innovation: cats.innovation ?? null,
                      execution: cats.execution ?? null,
                      presentation: cats.presentation ?? null,
                      ux_polish: cats.ux_polish ?? null,
                      notes: scoreNotes[team.id] || null,
                    });
                    showFeedback(res.error);
                  })}
                  className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-white hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  Save Score
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard tab */}
        {tab === "leaderboard" && (
          <div className="space-y-4 animate-slide-up">
            <div className="glass rounded-[28px] p-6 border-white/20 flex items-center justify-between">
              <div>
                <p className="text-sm">Leaderboard Visible to Attendees</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
                  {settings?.leaderboard_visible ? "Scores are live" : "Hidden during judging"}
                </p>
              </div>
              <button
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  const newVal = !settings?.leaderboard_visible;
                  const res = await toggleLeaderboard(adminCode, newVal);
                  if (res.success) setSettings((prev) => prev ? { ...prev, leaderboard_visible: newVal } : prev);
                  else setError(res.error ?? "Failed");
                })}
                className={cn(
                  "relative w-14 h-7 rounded-full border transition-all duration-200",
                  settings?.leaderboard_visible
                    ? "bg-green-500/40 border-green-400/60"
                    : "bg-white/5 border-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-5 h-5 rounded-full transition-all duration-200",
                  settings?.leaderboard_visible ? "left-8 bg-green-400" : "left-1 bg-gray-600"
                )} />
              </button>
            </div>

            {rankedTeams.length === 0 && (
              <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
                No scored teams yet
              </div>
            )}

            {rankedTeams.map((team, i) => (
              <div key={team.id} className={cn(
                "glass rounded-[24px] p-5 border-white/20 flex items-center gap-5",
                i === 0 && "border-yellow-400/20 bg-yellow-400/5"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg font-light",
                  i === 0 ? "bg-yellow-400/20 text-yellow-400" :
                  i === 1 ? "bg-gray-400/10 text-gray-300" :
                  i === 2 ? "bg-orange-400/10 text-orange-400" :
                  "bg-white/5 text-gray-500"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{team.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 truncate">
                    {team.members.map((m) => m.user?.name).filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-light tabular-nums">{totalScore(team.id)}</p>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-gray-600">/ 40 pts</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
