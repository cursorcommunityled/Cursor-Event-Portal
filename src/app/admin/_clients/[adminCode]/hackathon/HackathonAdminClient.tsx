"use client";

import { useState, useTransition, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  toggleHackathonMode,
  toggleTeamFormation,
  saveHackathonSettings,
  toggleLeaderboard,
  adminSetTeamLock,
  adminReviewTeamIcon,
  saveHackathonScore,
  adminRemoveTeamMember,
  adminDissolveTeam,
} from "@/lib/actions/hackathon";
import { triggerTeamMatchSuggestions } from "@/lib/actions/team-suggestions";
import { pushTopAIToFinalRound } from "@/lib/actions/hackathon-analysis";
import {
  Swords, Settings, Users, Trophy, BarChart3,
  Lock, Unlock, ArrowLeft, Check, X, ChevronDown, ChevronUp,
  ImageIcon, MessageSquare, Star, Sparkles, Plus, Cpu, Award,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  Event, HackathonSettings, HackathonTeamWithMembers, HackathonScore,
  HackathonChatChannel, HackathonChatMessage, ChatMember, CompetitionJudgingCompetition,
} from "@/types";
import { HackathonChat } from "@/components/hackathon-chat/HackathonChat";
import { HackathonJudgingAdminPanel } from "@/components/hackathon-judging/HackathonJudgingAdminPanel";
import { AIAnalysisPanel } from "@/components/hackathon-judging/AIAnalysisPanel";
import type { HackathonAIAnalysis } from "@/lib/hackathon-analysis/types";

interface Props {
  event: Event;
  adminCode: string;
  initialSettings: HackathonSettings | null;
  initialTeams: HackathonTeamWithMembers[];
  initialScores: HackathonScore[];
  chatChannels: HackathonChatChannel[];
  initialMessages: HackathonChatMessage[];
  initialChannelId: string;
  chatMembers: ChatMember[];
  adminUserId: string | null;
  judgingCompetitions: CompetitionJudgingCompetition[];
  initialAiAnalyses: Record<string, HackathonAIAnalysis[]>;
}

type Tab = "settings" | "teams" | "scoring" | "leaderboard" | "judging" | "chat";
type SimonTodoItem = { id: string; text: string };
type SimonTodoTarget = string | number;
type SimonTodoConsoleApi = {
  help: () => string;
  list: () => SimonTodoItem[];
  set: (items: Array<string | Partial<SimonTodoItem>>) => SimonTodoItem[];
  add: (text: string) => SimonTodoItem[];
  update: (target: SimonTodoTarget, text: string) => SimonTodoItem[];
  remove: (target: SimonTodoTarget) => SimonTodoItem[];
  reset: () => SimonTodoItem[];
};
type WindowWithSimonTodo = Window & { simonTodo?: SimonTodoConsoleApi };

const SCORE_CATEGORIES = [
  { key: "innovation" as const, label: "Innovation" },
  { key: "execution" as const, label: "Execution" },
  { key: "presentation" as const, label: "Presentation" },
  { key: "ux_polish" as const, label: "UX / Polish" },
];

const DEFAULT_SIMON_TODO_ITEMS: SimonTodoItem[] = [
  {
    id: "spawn-point-channel",
    text: 'Create a "Spawn Point" channel for all undrafted members; remove members once assigned to a team.',
  },
  { id: "qa-fix-reply", text: 'For Q&A, reply with "fix".' },
  { id: "booking-barrier", text: "Booking might be a barrier." },
  {
    id: "team-profile-review",
    text: "For forming teams, add a way to check profiles before assigning teams; use an LLM layer for suggestions.",
  },
  { id: "add-admin-mxistix", text: "Add mxistix@gmail.com to Admin on Cursor Admin." },
  { id: "confirm-photographer", text: "Confirm with Damian for photographer." },
  { id: "rubric-clarity", text: "Clarify rubric and judging criteria." },
  { id: "audience-favorite-vote", text: "Add audience favorite project vote; consider noise/cheer voting." },
  { id: "presentation-engagement", text: "Keep audience engaged during presentations." },
  { id: "cursor-pro-prize", text: "Confirm Cursor Pro $20 prize for winners." },
  { id: "printed-glasses-trophy", text: "Prep 3D printed glasses and trophy." },
  { id: "progressive-house", text: "Play progressive house during build." },
  { id: "demo-av-check", text: "Demo AV setup and check." },
];

function simonTodoItemsStorageKey(eventId: string) {
  return `hackathon-admin:${eventId}:simon-todo-items`;
}

function simonTodoCheckedStorageKey(eventId: string) {
  return `hackathon-admin:${eventId}:simon-todo`;
}

function createTodoId(text: string, existingIds: Set<string>) {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "todo";
  let id = base;
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  existingIds.add(id);
  return id;
}

function normalizeSimonTodoItems(items: unknown): SimonTodoItem[] {
  if (!Array.isArray(items)) return [];

  const existingIds = new Set<string>();
  return items.reduce<SimonTodoItem[]>((acc, item) => {
    const text = typeof item === "string"
      ? item.trim()
      : typeof item === "object" && item !== null && "text" in item
        ? String((item as { text?: unknown }).text ?? "").trim()
        : "";

    if (!text) return acc;

    const requestedId = typeof item === "object" && item !== null && "id" in item
      ? String((item as { id?: unknown }).id ?? "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";
    const id = requestedId && !existingIds.has(requestedId)
      ? requestedId
      : createTodoId(text, existingIds);

    existingIds.add(id);
    acc.push({ id, text });
    return acc;
  }, []);
}

function resolveSimonTodoIndex(items: SimonTodoItem[], target: SimonTodoTarget) {
  if (typeof target === "number") {
    return Number.isInteger(target) ? target - 1 : -1;
  }

  const needle = target.trim().toLowerCase();
  return items.findIndex((item) => (
    item.id.toLowerCase() === needle ||
    item.text.toLowerCase().includes(needle)
  ));
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
}

function buildScoreInputs(
  teams: HackathonTeamWithMembers[],
  scores: HackathonScore[]
): Record<string, Record<string, number | null>> {
  const init: Record<string, Record<string, number | null>> = {};
  for (const team of teams) {
    const teamScores = scores.filter((s) => s.team_id === team.id);
    const merged: Record<string, number | null> = {};
    for (const s of teamScores) {
      for (const cat of SCORE_CATEGORIES) {
        if (s[cat.key] != null) merged[cat.key] = s[cat.key];
      }
    }
    init[team.id] = merged;
  }
  return init;
}

function buildScoreNotes(scores: HackathonScore[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const s of scores) init[s.team_id] = s.notes ?? "";
  return init;
}

export function HackathonAdminClient({
  event, adminCode, initialSettings, initialTeams, initialScores,
  chatChannels, initialMessages, initialChannelId, chatMembers, adminUserId,
  judgingCompetitions, initialAiAnalyses,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("settings");
  const [isPending, startTransition] = useTransition();
  const [isHackathon, setIsHackathon] = useState(event.is_hackathon);
  const [settings, setSettings] = useState(initialSettings);
  const [teams, setTeams] = useState(initialTeams);
  const [scores, setScores] = useState(initialScores);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [todoItems, setTodoItems] = useState<SimonTodoItem[]>(DEFAULT_SIMON_TODO_ITEMS);
  const [checkedTodoIds, setCheckedTodoIds] = useState<Set<string>>(new Set());
  const [newTodoText, setNewTodoText] = useState("");

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
  const [scoreInputs, setScoreInputs] = useState<Record<string, Record<string, number | null>>>(() =>
    buildScoreInputs(initialTeams, initialScores)
  );
  const [scoreNotes, setScoreNotes] = useState<Record<string, string>>(() =>
    buildScoreNotes(initialScores)
  );

  // Team match suggestions state
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [suggestCount, setSuggestCount] = useState<number | null>(null);

  // AI analysis state (keyed by teamId)
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, HackathonAIAnalysis[]>>(initialAiAnalyses);

  // Push top AI to final round
  const [pushStatus, setPushStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [pushResult, setPushResult] = useState<string | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setIsHackathon(event.is_hackathon);
  }, [event.is_hackathon]);

  useEffect(() => {
    setSettings(initialSettings);
    setTeamFormationEnabled(initialSettings?.team_formation_enabled ?? true);
    setFormOpens(fmt(initialSettings?.team_formation_opens_at));
    setFormCloses(fmt(initialSettings?.team_formation_closes_at));
    setFormSubmission(fmt(initialSettings?.submission_deadline));
    setFormJudging(fmt(initialSettings?.judging_starts_at));
    setFormMinSize(initialSettings?.min_team_size ?? 2);
    setFormMaxSize(initialSettings?.max_team_size ?? 4);
  }, [initialSettings]);

  useEffect(() => {
    setTeams(initialTeams);
    setScores(initialScores);
    setScoreInputs(buildScoreInputs(initialTeams, initialScores));
    setScoreNotes(buildScoreNotes(initialScores));
  }, [initialTeams, initialScores]);

  useEffect(() => {
    const storedItems = window.localStorage.getItem(simonTodoItemsStorageKey(event.id));
    if (!storedItems) {
      setTodoItems(DEFAULT_SIMON_TODO_ITEMS);
    } else {
      try {
        const parsedItems = normalizeSimonTodoItems(JSON.parse(storedItems));
        setTodoItems(parsedItems.length > 0 ? parsedItems : DEFAULT_SIMON_TODO_ITEMS);
      } catch {
        setTodoItems(DEFAULT_SIMON_TODO_ITEMS);
      }
    }

    const stored = window.localStorage.getItem(simonTodoCheckedStorageKey(event.id));
    if (!stored) {
      setCheckedTodoIds(new Set());
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setCheckedTodoIds(Array.isArray(parsed) ? new Set(parsed) : new Set());
    } catch {
      setCheckedTodoIds(new Set());
    }
  }, [event.id]);

  const saveTodoItems = useCallback((items: SimonTodoItem[]) => {
    const next = normalizeSimonTodoItems(items);
    if (next.length === 0) {
      throw new Error("Todo list must include at least one item.");
    }

    setTodoItems(next);
    window.localStorage.setItem(simonTodoItemsStorageKey(event.id), JSON.stringify(next));

    const validIds = new Set(next.map((item) => item.id));
    setCheckedTodoIds((prev) => {
      const filtered = new Set([...prev].filter((id) => validIds.has(id)));
      window.localStorage.setItem(simonTodoCheckedStorageKey(event.id), JSON.stringify([...filtered]));
      return filtered;
    });

    return next;
  }, [event.id]);

  useEffect(() => {
    const win = window as WindowWithSimonTodo;
    const api: SimonTodoConsoleApi = {
      help: () => "Use simonTodo.list(), simonTodo.add('Task'), simonTodo.update(1, 'Task'), simonTodo.remove(1), simonTodo.set(['Task A', 'Task B']), or simonTodo.reset(). Number targets are 1-based.",
      list: () => todoItems.map((item) => ({ ...item })),
      set: (items) => saveTodoItems(normalizeSimonTodoItems(items)),
      add: (text) => {
        const trimmed = text.trim();
        if (!trimmed) throw new Error("Todo text is required.");
        const existingIds = new Set(todoItems.map((item) => item.id));
        return saveTodoItems([...todoItems, { id: createTodoId(trimmed, existingIds), text: trimmed }]);
      },
      update: (target, text) => {
        const trimmed = text.trim();
        if (!trimmed) throw new Error("Todo text is required.");
        const index = resolveSimonTodoIndex(todoItems, target);
        if (index < 0) throw new Error(`Todo not found: ${target}`);
        return saveTodoItems(todoItems.map((item, i) => (i === index ? { ...item, text: trimmed } : item)));
      },
      remove: (target) => {
        const index = resolveSimonTodoIndex(todoItems, target);
        if (index < 0) throw new Error(`Todo not found: ${target}`);
        return saveTodoItems(todoItems.filter((_, i) => i !== index));
      },
      reset: () => saveTodoItems(DEFAULT_SIMON_TODO_ITEMS),
    };

    win.simonTodo = api;
    return () => {
      if (win.simonTodo === api) delete win.simonTodo;
    };
  }, [saveTodoItems, todoItems]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`hackathon-admin-${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_settings", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_teams", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_team_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_team_invites", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_projects", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_scores", filter: `event_id=eq.${event.id}` }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hackathon_ai_analyses", filter: `event_id=eq.${event.id}` },
        (payload) => {
          const row = payload.new as HackathonAIAnalysis;
          if (!row?.team_id) { refresh(); return; }
          setAiAnalyses((prev) => {
            const existing = prev[row.team_id] ?? [];
            const idx = existing.findIndex((a) => a.pass_name === row.pass_name);
            const updated = idx >= 0
              ? existing.map((a, i) => (i === idx ? row : a))
              : [...existing, row];
            return { ...prev, [row.team_id]: updated };
          });
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_finalist_entries", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_judging_scorecards", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_judging_score_items" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_judging_results", filter: `event_id=eq.${event.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_photos", filter: `event_id=eq.${event.id}` }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, refresh]);

  const showFeedback = (err?: string) => {
    if (err) { setError(err); return; }
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const togglePlanningTodo = (itemId: string) => {
    setCheckedTodoIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      window.localStorage.setItem(simonTodoCheckedStorageKey(event.id), JSON.stringify([...next]));
      return next;
    });
  };

  const addPlanningTodo = () => {
    const text = newTodoText.trim();
    if (!text) return;

    const existingIds = new Set(todoItems.map((item) => item.id));
    saveTodoItems([...todoItems, { id: createTodoId(text, existingIds), text }]);
    setNewTodoText("");
  };

  const completedTodoCount = todoItems.filter((item) => checkedTodoIds.has(item.id)).length;

  function totalScore(teamId: string): number {
    const cats = scoreInputs[teamId] ?? {};
    return SCORE_CATEGORIES.reduce((sum, c) => sum + (cats[c.key] ?? 0), 0);
  }

  const rankedTeams = [...teams]
    .filter((t) => scores.some((s) => s.team_id === t.id))
    .sort((a, b) => totalScore(b.id) - totalScore(a.id));

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
    { id: "teams", label: `Teams (${teams.length})`, icon: <Users className="w-4 h-4" /> },
    { id: "scoring", label: "AI Screen", icon: <Cpu className="w-4 h-4" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
    { id: "judging", label: "Final Round", icon: <Award className="w-4 h-4" /> },
    { id: "chat", label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
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
            <Swords className="w-4 h-4 text-red-400" />
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
                ? "bg-red-500/40 border-red-400/60"
                : "bg-white/5 border-white/10"
            )}
          >
            <div className={cn(
              "absolute top-1 w-5 h-5 rounded-full transition-all duration-200",
              isHackathon ? "left-8 bg-red-400" : "left-1 bg-gray-600"
            )} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="relative mx-auto flex w-full max-w-fit flex-wrap justify-center gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl shadow-2xl animate-slide-up">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300",
                tab === t.id
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
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

            <details className="group border-t border-white/5 pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Pre-Hackathon Planning</p>
                  <h3 className="mt-1 text-sm font-light text-white/70">Simon&apos;s Todo</h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-600">
                  <span>{completedTodoCount}/{todoItems.length}</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                </div>
              </summary>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addPlanningTodo();
                }}
                className="mt-4 flex gap-2"
              >
                <input
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  placeholder="Add a new todo..."
                  className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-sm text-white/70 placeholder:text-gray-700 focus:border-white/20 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newTodoText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </form>

              <div className="mt-3 space-y-2">
                {todoItems.map((item) => {
                  const checked = checkedTodoIds.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-sm text-white/60 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlanningTodo(item.id)}
                        className="mt-0.5 h-4 w-4 rounded border-white/10 bg-white/5 accent-red-400"
                      />
                      <span className={cn("leading-relaxed", checked && "text-gray-600 line-through")}>
                        {item.text}
                      </span>
                    </label>
                  );
                })}
                <p className="pt-2 text-[10px] leading-relaxed text-gray-600">
                  Console editing: <code className="text-gray-500">simonTodo.help()</code>
                </p>
              </div>
            </details>
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
              <div key={team.id} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all hover:bg-white/[0.04] space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                      {team.icon_photo?.status === "approved" ? (
                        <Image
                          src={team.icon_photo.file_url}
                          alt={`${team.name} icon`}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0 pt-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold tracking-tight text-white">{team.name}</h3>
                        {team.locked_at && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                        {team.project?.submitted_at && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
                            Project Submitted
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                        {team.icon_photo?.status === "pending" && <span className="ml-3 text-amber-500">Icon pending</span>}
                        {team.icon_photo?.status === "rejected" && <span className="ml-3 text-red-500">Icon rejected</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {team.icon_photo?.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          disabled={isPending}
                          onClick={() => startTransition(async () => {
                            const res = await adminReviewTeamIcon(adminCode, team.id, "approved");
                            if (res.success) {
                              setTeams((prev) => prev.map((t) =>
                                t.id === team.id && t.icon_photo
                                  ? { ...t, icon_photo: { ...t.icon_photo, status: "approved" as const, reviewed_at: new Date().toISOString() } }
                                  : t
                              ));
                            } else setError(res.error ?? "Failed");
                          })}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Icon
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => startTransition(async () => {
                            const res = await adminReviewTeamIcon(adminCode, team.id, "rejected");
                            if (res.success) {
                              setTeams((prev) => prev.map((t) =>
                                t.id === team.id && t.icon_photo
                                  ? { ...t, icon_photo: { ...t.icon_photo, status: "rejected" as const, reviewed_at: new Date().toISOString() } }
                                  : t
                              ));
                            } else setError(res.error ?? "Failed");
                          })}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Icon
                        </button>
                      </div>
                    )}
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
                        "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all",
                        team.locked_at
                          ? "border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                          : "border-white/10 text-gray-400 hover:text-white hover:border-white/30 hover:bg-white/5"
                      )}
                    >
                      {team.locked_at ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => startTransition(async () => {
                        if (!confirm(`Dissolve ${team.name}? This removes the team and returns all members to the open pool.`)) return;
                        const res = await adminDissolveTeam(adminCode, team.id);
                        if (res.success) {
                          setTeams((prev) => prev.filter((t) => t.id !== team.id));
                        } else setError(res.error ?? "Failed");
                      })}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> Dissolve
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {team.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                      <span className="text-[13px] font-medium text-gray-200">{m.user?.name ?? "Unknown"}</span>
                      {m.role === "leader" && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">Leader</span>
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
                        className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {team.project && (
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <p className="text-[14px] font-bold text-white">{team.project.name}</p>
                    {team.project.description && (
                      <p className="text-[13px] font-medium text-gray-400 leading-relaxed">{team.project.description}</p>
                    )}
                    <div className="flex gap-3 mt-3">
                      {team.project.repo_url && (
                        <a href={team.project.repo_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
                          Repo →
                        </a>
                      )}
                      {team.project.demo_url && (
                        <a href={team.project.demo_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-green-400 transition-colors hover:bg-green-500/10 hover:text-green-300">
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

        {/* AI Screening tab */}
        {tab === "scoring" && (
          <div className="space-y-4 animate-slide-up">
            {/* Flow explanation + push button */}
            <div className="relative overflow-hidden rounded-[28px] border border-red-500/20 bg-black/40 p-5 shadow-2xl backdrop-blur-xl">
              <div className="absolute inset-0 bg-grid-red opacity-5" />
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-red-500/10 blur-[50px]" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
                    <img src="/cursor-logo.svg" alt="Cursor" className="w-6 h-6 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] brightness-200" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-red-400 mb-1">How AI Screening Works</p>
                    <p className="text-[13px] text-gray-400 leading-relaxed">
                      Step 1: Teams submit project + repo URL + screenshots.<br/>
                      Step 2: Run AI analysis per team below — Cursor scores across 7 criteria (~3 min each).<br/>
                      Step 3: Push the top scored projects to Final Round, or hand-pick them.<br/>
                      Step 4: Go to <strong className="text-white">Final Round</strong> tab to add your own judge scores.
                    </p>
                  </div>
                </div>

                {judgingCompetitions.length > 0 && (
                  <div className="flex items-center justify-between gap-4 border-t border-red-500/20 pt-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white/80">Push Top 8 to Final Round</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Takes the 8 highest AI-scored projects and sends them to <strong className="text-gray-400">{judgingCompetitions[0]?.title}</strong> as finalists.
                    </p>
                    {pushStatus === "done" && pushResult && (
                      <p className="text-[11px] text-green-400 mt-1">{pushResult}</p>
                    )}
                    {pushStatus === "error" && pushResult && (
                      <p className="text-[11px] text-red-400 mt-1">{pushResult}</p>
                    )}
                  </div>
                  <button
                    disabled={pushStatus === "pending" || !judgingCompetitions[0]}
                    onClick={async () => {
                      if (!judgingCompetitions[0]) return;
                      if (!confirm("This will replace the current Final Round finalists with the top 8 AI-scored projects. Continue?")) return;
                      setPushStatus("pending");
                      setPushResult(null);
                      const res = await pushTopAIToFinalRound(adminCode, event.id, judgingCompetitions[0].id, 8);
                      if (res.error) {
                        setPushStatus("error");
                        setPushResult(res.error);
                      } else {
                        setPushStatus("done");
                        setPushResult(`${res.pushed} project${res.pushed !== 1 ? "s" : ""} added to Final Round.`);
                        refresh();
                      }
                    }}
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-semibold border border-yellow-400/40 bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/30 transition-all disabled:opacity-50"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    {pushStatus === "pending" ? "Pushing…" : "Push Top 8"}
                  </button>
                </div>
              )}
            </div>
            </div>
            {teams.length === 0 && (
              <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
                No teams to score yet
              </div>
            )}
            {teams.map((team) => (
              <div key={team.id} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all hover:bg-white/[0.04] space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-white">{team.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">
                      {team.members.map((m) => m.user?.name).join(" · ")}
                    </p>
                  </div>
                  <div className="text-3xl font-black tabular-nums text-white drop-shadow-md">
                    {totalScore(team.id)}<span className="text-sm font-bold text-gray-500">/40</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {SCORE_CATEGORIES.map((cat) => (
                    <div key={cat.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{cat.label}</span>
                        <span className="text-[13px] font-bold tabular-nums text-white">
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
                        className="w-full accent-red-500"
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  placeholder="Judge notes..."
                  rows={2}
                  value={scoreNotes[team.id] ?? ""}
                  onChange={(e) => setScoreNotes((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-medium text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 resize-none transition-colors"
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
                  className="w-full py-3 rounded-xl bg-white/10 border border-white/10 text-[13px] font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  Save Score
                </button>

                <AIAnalysisPanel
                  teamId={team.id}
                  teamName={team.name}
                  eventId={event.id}
                  adminCode={adminCode}
                  analyses={aiAnalyses[team.id] ?? []}
                  hasRepo={!!team.project?.repo_url}
                />
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard tab */}
        {tab === "leaderboard" && (
          <div className="space-y-4 animate-slide-up">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl flex items-center justify-between">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:15px_15px]" />
              <div className="relative">
                <p className="text-[15px] font-bold text-white">Leaderboard Visible to Attendees</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-1">
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
                  "relative w-14 h-7 rounded-full border transition-all duration-300",
                  settings?.leaderboard_visible
                    ? "bg-green-500/40 border-green-500/60 shadow-[0_0_15px_rgba(74,222,128,0.3)]"
                    : "bg-white/5 border-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-5 h-5 rounded-full transition-all duration-300",
                  settings?.leaderboard_visible ? "left-8 bg-green-400" : "left-1 bg-gray-500"
                )} />
              </button>
            </div>

            {rankedTeams.length === 0 && (
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-2xl">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
                <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[60px]" />
                <p className="relative text-[16px] font-bold text-gray-400">No scored teams yet</p>
              </div>
            )}

            {rankedTeams.map((team, i) => (
              <div key={team.id} className={cn(
                "relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-xl flex items-center gap-5 transition-all hover:scale-[1.02]",
                i === 0 ? "border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.15)]" : "border-white/10 bg-black/40 hover:bg-white/[0.04]"
              )}>
                {i === 0 && <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-yellow-500/20 blur-[40px]" />}
                <div className={cn(
                  "relative flex w-12 h-12 shrink-0 items-center justify-center rounded-2xl text-[18px] font-black shadow-inner",
                  i === 0 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-neon" :
                  i === 1 ? "bg-gray-400/10 text-gray-300 border border-gray-400/20" :
                  i === 2 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                  "bg-white/5 text-gray-500 border border-white/10"
                )}>
                  {i + 1}
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-white tracking-tight truncate">{team.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 truncate mt-0.5">
                    {team.members.map((m) => m.user?.name).filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="relative text-right shrink-0">
                  <p className="text-3xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{totalScore(team.id)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">/ 40 pts</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Final Round judging tab */}
        {tab === "judging" && (
          <HackathonJudgingAdminPanel
            adminCode={adminCode}
            eventSlug={event.slug}
            adminUserId={adminUserId}
            competitions={judgingCompetitions}
            teams={teams}
            aiAnalyses={aiAnalyses}
          />
        )}

        {/* Chat tab */}
        {tab === "chat" && adminUserId && (
          <div className="animate-slide-up space-y-4">
            {/* Team match suggestions trigger */}
            <div className="glass rounded-[28px] p-5 border-white/20 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white/80">AI Team Match Suggestions</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Analyse unassigned attendee profiles and send each one a DM suggesting who to invite.
                </p>
                {suggestStatus === "done" && suggestCount !== null && (
                  <p className="text-[11px] text-green-400 mt-1">{suggestCount} suggestion{suggestCount !== 1 ? "s" : ""} sent.</p>
                )}
                {suggestStatus === "error" && (
                  <p className="text-[11px] text-red-400 mt-1">Failed — check that ANTHROPIC_API_KEY is set and attendees have intake data.</p>
                )}
              </div>
              <button
                disabled={suggestStatus === "pending"}
                onClick={async () => {
                  setSuggestStatus("pending");
                  const res = await triggerTeamMatchSuggestions(event.id);
                  if (res.error) {
                    setSuggestStatus("error");
                  } else {
                    setSuggestStatus("done");
                    setSuggestCount(res.count ?? 0);
                  }
                }}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-semibold border border-red-400/40 bg-red-500/15 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {suggestStatus === "pending" ? "Generating…" : "Suggest Teams"}
              </button>
            </div>

            <div style={{ height: "calc(100vh - 28rem)" }}>
              <HackathonChat
                event={event}
                userId={adminUserId}
                isAdmin={true}
                channels={chatChannels}
                initialMessages={initialMessages}
                initialChannelId={initialChannelId}
                members={chatMembers}
                myTeamId={null}
              />
            </div>
          </div>
        )}
        {tab === "chat" && !adminUserId && (
          <div className="glass rounded-[28px] p-10 border-white/20 text-center text-gray-500 text-sm animate-slide-up">
            Sign in as a registered attendee to access chat
          </div>
        )}
      </main>
    </div>
  );
}
