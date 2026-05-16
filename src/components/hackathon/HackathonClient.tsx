"use client";

import React, { useState, useTransition, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  sendTeamInvite,
  acceptTeamInvite,
  declineTeamInvite,
  leaveTeam,
  dissolveTeam,
  submitHackathonProject,
} from "@/lib/actions/hackathon";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users, Swords, UserPlus, X, Check, Lock, Clock,
  LogOut, Github, Globe, ExternalLink, ChevronDown,
  Camera, ImageIcon, Loader2, MessageSquare,
} from "lucide-react";
import type {
  Event, HackathonSettings, HackathonTeamWithMembers,
  HackathonTeamInvite, HackathonScore, EventPhoto,
  HackathonChatChannel, HackathonChatMessage, ChatMember, CompetitionJudgingResult,
} from "@/types";
import { HackathonChat } from "@/components/hackathon-chat/HackathonChat";
import { JudgingWinnersPodium } from "@/components/hackathon-judging/JudgingWinnersReveal";
import { HackathonEffects } from "@/components/hackathon/HackathonEffects";

interface Props {
  event: Event;
  userId: string;
  isAdmin: boolean;
  settings: HackathonSettings | null;
  myTeam: HackathonTeamWithMembers | null;
  receivedInvites: HackathonTeamInvite[];
  sentInviteUserIds: string[];
  allTeams: HackathonTeamWithMembers[];
  openPool: { id: string; name: string }[];
  scores: HackathonScore[];
  chatChannels: HackathonChatChannel[];
  initialMessages: HackathonChatMessage[];
  initialChannelId: string;
  chatMembers: ChatMember[];
  publishedJudgingResults: CompetitionJudgingResult[];
  needsTeam?: boolean;
  initialScreenshots?: { id: string; file_url: string }[];
  initialTeamAnalyses?: { id: string; pass_name: string; status: string; updated_at: string }[];
}

type Tab = "overview" | "my-team" | "all-teams" | "open-pool" | "chat";

function isFormationOpen(settings: HackathonSettings | null): boolean {
  if (!settings) return true;
  if (!settings.team_formation_enabled) return false; // manual kill switch
  const now = new Date();
  if (settings.team_formation_opens_at && new Date(settings.team_formation_opens_at) > now) return false;
  if (settings.team_formation_closes_at && new Date(settings.team_formation_closes_at) < now) return false;
  return true;
}

function totalScore(teamId: string, scores: HackathonScore[]): number {
  const s = scores.filter((x) => x.team_id === teamId);
  if (!s.length) return 0;
  const cats = ["innovation", "execution", "presentation", "ux_polish"] as const;
  return Math.round(
    s.reduce((sum, score) => {
      return sum + cats.reduce((c, k) => c + (score[k] ?? 0), 0);
    }, 0) / s.length
  );
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function formatEventDateTime(value: string | null | undefined, timezone?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  });
}

function formatCountdown(targetValue: string | null | undefined, now: Date | null) {
  if (!targetValue) return "Not scheduled";
  if (!now) return formatEventDateTime(targetValue);

  const diffMs = new Date(targetValue).getTime() - now.getTime();
  if (diffMs <= 0) return "Live now";

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function HackathonClient({
  event, userId, isAdmin, settings, myTeam: initialMyTeam,
  receivedInvites: initialInvites, sentInviteUserIds: initialSent,
  allTeams: initialAllTeams, openPool: initialPool, scores,
  chatChannels, initialMessages, initialChannelId, chatMembers,
  publishedJudgingResults, needsTeam = false, initialScreenshots = [], initialTeamAnalyses = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const [now, setNow] = useState<Date | null>(null);

  // Local state (updated by realtime or optimistic)
  const [myTeam, setMyTeam] = useState(initialMyTeam);
  const [receivedInvites, setReceivedInvites] = useState(initialInvites);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set(initialSent));
  const [allTeams, setAllTeams] = useState(initialAllTeams);
  const [pool, setPool] = useState(initialPool);

  // Invite modal
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newTeamName, setNewTeamName] = useState("");

  // Project form
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState(myTeam?.project?.name ?? "");
  const [projectDesc, setProjectDesc] = useState(myTeam?.project?.description ?? "");
  const [projectRepo, setProjectRepo] = useState(myTeam?.project?.repo_url ?? "");
  const [projectDemo, setProjectDemo] = useState(myTeam?.project?.demo_url ?? "");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const teamIconInputRef = useRef<HTMLInputElement>(null);

  // Screenshots
  const [screenshots, setScreenshots] = useState<{ id: string; file_url: string }[]>(initialScreenshots);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotUpload = async (file: File | undefined) => {
    if (!file || !myTeam) return;
    if (screenshots.length >= 5) { showMsg("Max 5 screenshots", true); return; }
    setUploadingScreenshot(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("eventId", event.id);
      fd.append("teamId", myTeam.id);
      const res = await fetch("/api/hackathon/screenshot", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error || "Upload failed", true); return; }
      setScreenshots((prev) => [...prev, { id: data.screenshot.id, file_url: data.screenshot.file_url }]);
    } catch { showMsg("Upload failed", true); }
    finally { setUploadingScreenshot(false); }
  };

  const handleScreenshotDelete = async (id: string) => {
    if (!myTeam) return;
    if (!confirm("Remove this screenshot?")) return;
    const res = await fetch("/api/hackathon/screenshot", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenshotId: id, teamId: myTeam.id }),
    });
    if (res.ok) setScreenshots((prev) => prev.filter((s) => s.id !== id));
  };

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formationOpen = isFormationOpen(settings);
  const teamLocked = !formationOpen;
  const leaderboardVisible = settings?.leaderboard_visible ?? false;
  const maxTeamSize = settings?.max_team_size ?? 4;
  const totalTeamMembers = allTeams.reduce((sum, team) => sum + team.members.length, 0);
  const submittedProjects = allTeams.filter((team) => team.project?.submitted_at).length;
  const totalParticipants = totalTeamMembers + pool.length;
  const eventHasStarted = !!event.start_time && !!now && new Date(event.start_time) <= now;
  const openTeamSlots = formationOpen
    ? allTeams.reduce((sum, team) => sum + Math.max(0, maxTeamSize - team.members.length), 0)
    : 0;
  const rankedTeams = useMemo(
    () => [...allTeams].sort((a, b) => totalScore(b.id, scores) - totalScore(a.id, scores)),
    [allTeams, scores]
  );
  const leadingTeam = leaderboardVisible ? rankedTeams[0] : null;

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // Keep local interactive state aligned with refreshed server props.
  useEffect(() => {
    setMyTeam(initialMyTeam);
    setReceivedInvites(initialInvites);
    setSentIds(new Set(initialSent));
    setAllTeams(initialAllTeams);
    setPool(initialPool);
  }, [initialMyTeam, initialInvites, initialSent, initialAllTeams, initialPool]);

  useEffect(() => {
    if (showProjectForm) return;
    setProjectName(myTeam?.project?.name ?? "");
    setProjectDesc(myTeam?.project?.description ?? "");
    setProjectRepo(myTeam?.project?.repo_url ?? "");
    setProjectDemo(myTeam?.project?.demo_url ?? "");
  }, [myTeam, showProjectForm]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // AI analysis status state (status only — no scores until admin applies)
  const [teamAnalyses, setTeamAnalyses] = useState(initialTeamAnalyses);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const analysisChannel = myTeam
      ? supabase
          .channel(`hackathon-ai-${myTeam.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "hackathon_ai_analyses", filter: `team_id=eq.${myTeam.id}` },
            (payload) => {
              const row = payload.new as { id: string; pass_name: string; status: string; updated_at: string };
              if (!row?.pass_name) return;
              setTeamAnalyses((prev) => {
                const idx = prev.findIndex((a) => a.pass_name === row.pass_name);
                return idx >= 0
                  ? prev.map((a, i) => (i === idx ? { ...a, status: row.status, updated_at: row.updated_at } : a))
                  : [...prev, row];
              });
            }
          )
          .subscribe()
      : null;

    const channels = [
      supabase
        .channel(`hackathon-teams-${event.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_teams", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_team_members" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_projects", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_scores", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_settings", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "event_photos", filter: `event_id=eq.${event.id}` }, refresh)
        .subscribe(),
      supabase
        .channel(`hackathon-invites-${event.id}-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_team_invites", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_team_invites", filter: `invited_user_id=eq.${userId}` }, refresh)
        .subscribe(),
    ];
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
      if (analysisChannel) supabase.removeChannel(analysisChannel);
    };
  }, [event.id, userId, myTeam?.id, refresh]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  };

  const handleSendInvite = () => {
    if (!inviteTarget) return;
    startTransition(async () => {
      const res = await sendTeamInvite(
        event.id,
        inviteTarget.id,
        myTeam ? undefined : newTeamName.trim() || undefined
      );
      if (res.error) { showMsg(res.error, true); return; }
      setSentIds((prev) => new Set([...prev, inviteTarget.id]));
      setInviteTarget(null);
      setNewTeamName("");
      showMsg(`Invite sent to ${inviteTarget.name}`);
      refresh();
    });
  };

  const handleAccept = (inviteId: string) => {
    startTransition(async () => {
      const res = await acceptTeamInvite(inviteId);
      if (res.error) { showMsg(res.error, true); return; }
      setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setTab("my-team");
      refresh();
    });
  };

  const handleDecline = (inviteId: string) => {
    startTransition(async () => {
      const res = await declineTeamInvite(inviteId);
      if (res.error) { showMsg(res.error, true); return; }
      setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
    });
  };

  const handleLeave = () => {
    if (!myTeam) return;
    if (!confirm("Leave your team?")) return;
    startTransition(async () => {
      const res = await leaveTeam(myTeam.id);
      if (res.error) { showMsg(res.error, true); return; }
      setMyTeam(null);
      setTab("open-pool");
      refresh();
    });
  };

  const handleDissolve = () => {
    if (!myTeam) return;
    if (!confirm(`Dissolve ${myTeam.name}? This removes the team and returns every member to the open pool.`)) return;
    startTransition(async () => {
      const res = await dissolveTeam(myTeam.id);
      if (res.error) { showMsg(res.error, true); return; }
      showMsg("Team dissolved");
      setMyTeam(null);
      setTab("open-pool");
      refresh();
    });
  };

  const handleProjectSubmit = () => {
    if (!myTeam) return;
    startTransition(async () => {
      const res = await submitHackathonProject(myTeam.id, event.id, {
        name: projectName,
        description: projectDesc,
        repo_url: projectRepo,
        demo_url: projectDemo,
      });
      if (res.error) { showMsg(res.error, true); return; }
      showMsg("Project saved");
      setShowProjectForm(false);
      refresh();
    });
  };

  const handleTeamIconUpload = async (file: File | undefined) => {
    if (!file || !myTeam) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      showMsg("Only image files are supported (PNG, JPEG, WebP, GIF)", true);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showMsg("File size exceeds 10MB limit", true);
      return;
    }

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", event.id);
      formData.append("teamId", myTeam.id);

      const res = await fetch("/api/hackathon/team-icon", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg(data.error || "Upload failed", true);
        return;
      }

      const photo = data.photo as EventPhoto;
      setMyTeam((prev) => prev ? { ...prev, icon_photo_id: photo.id, icon_photo: photo } : prev);
      setAllTeams((prev) => prev.map((team) =>
        team.id === myTeam.id ? { ...team, icon_photo_id: photo.id, icon_photo: photo } : team
      ));
      showMsg("Team icon submitted for approval");
      refresh();
    } catch {
      showMsg("Upload failed. Please try again.", true);
    } finally {
      setUploadingIcon(false);
    }
  };

  const tabs: { id: Tab; label: string; count?: number; icon?: React.ReactNode }[] = [
    { id: "overview", label: "Hub", icon: <Swords className="w-3.5 h-3.5" /> },
    { id: "my-team", label: "My Team" },
    { id: "all-teams", label: "Teams", count: allTeams.length },
    { id: "open-pool", label: "Pool", count: pool.length },
    { id: "chat", label: "Chat", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  ];

  const header = (
    <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-black/40 px-5 py-6 shadow-2xl backdrop-blur-3xl sm:px-8 sm:py-8 group">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-grid-red/[0.05] bg-[size:30px_30px] opacity-20" />
      
      {/* Glowing orbs */}
      <div className="absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-red-600/30 blur-[80px] group-hover:bg-red-500/40 transition-colors duration-700" />
      <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-red-600/20 blur-[60px] group-hover:bg-red-500/30 transition-colors duration-700" />
      
      {/* Top highlight line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/20 shadow-neon overflow-hidden">
            <div className="absolute inset-0 rounded-2xl bg-red-400/10 animate-pulse-soft" />
            <img src="/cursor-logo.svg" alt="Cursor" className="w-8 h-8 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] brightness-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-300/90">
                System Active
              </p>
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
            </div>
            <h1 className="truncate text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-red-200 sm:text-5xl drop-shadow-lg">
              HACKATHON
            </h1>
            <p className="mt-1.5 truncate text-sm font-medium text-red-200/70 sm:text-[15px] uppercase tracking-widest">
              {event.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 self-start sm:self-center bg-black/40 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="relative w-24 h-10 sm:w-28 sm:h-12 opacity-80 hover:opacity-100 transition-opacity mix-blend-screen filter brightness-125">
            <Image src="/sait.jpeg" alt="SAIT" fill className="object-contain object-right" />
          </div>
          <div className="w-px h-10 bg-white/10 hidden sm:block" />
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 opacity-80 hover:opacity-100 transition-opacity rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
            <Image src="/megabyte-sait.jpeg" alt="Megabyte" fill className="object-cover" />
          </div>
        </div>
      </div>
    </div>
  );

  // Chat tab: full-width layout, skip the narrow container
  if (tab === "chat") {
    return (
      <main className="relative px-3 py-5 w-full animate-fade-in md:pl-40 md:pr-6">
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-30">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)]" />
        </div>
        <HackathonEffects 
          scoresCount={scores.length} 
          projectSubmitted={!!myTeam?.project?.submitted_at} 
          eventStarted={eventHasStarted} 
          teamFormed={!!myTeam}
        />
        <div className="mb-5 max-w-5xl mx-auto">
          {header}
        </div>
        {/* Tab bar — stays above chat */}
        <div className="relative mx-auto mb-5 flex w-full max-w-fit flex-wrap justify-center gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl shadow-2xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300",
                t.id === tab
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {t.icon}
              {t.label}
              {t.count != null && (
                <span className={cn(
                  "ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px]",
                  t.id === tab ? "bg-black/20 text-black" : "bg-white/10 text-gray-300"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <HackathonChat
          event={event}
          userId={userId}
          isAdmin={isAdmin}
          channels={chatChannels}
          initialMessages={initialMessages}
          initialChannelId={initialChannelId}
          members={chatMembers}
          myTeamId={myTeam?.id ?? null}
          needsTeam={needsTeam}
        />
      </main>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-4xl space-y-8 px-4 py-8 animate-fade-in sm:px-6 sm:py-12">
      {/* Page background effects */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-30">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)]" />
      </div>

      <HackathonEffects 
        scoresCount={scores.length} 
        projectSubmitted={!!myTeam?.project?.submitted_at} 
        eventStarted={eventHasStarted} 
        teamFormed={!!myTeam}
      />

      {/* Header */}
      {header}

      <JudgingWinnersPodium results={publishedJudgingResults} />

      {/* Pending invite banners */}
      {receivedInvites.length > 0 && (
        <div className="space-y-3">
          {receivedInvites.map((invite) => (
            <div key={invite.id} className="relative overflow-hidden rounded-[24px] border border-red-500/30 bg-red-500/10 p-5 backdrop-blur-xl shadow-neon">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15)_0,transparent_100%)]" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-[15px] font-medium leading-relaxed text-red-100">
                  <span className="font-bold text-white">{(invite.inviter as { name?: string } | undefined)?.name ?? "Someone"}</span>
                  {" invited you to join "}
                  <span className="font-bold text-white">"{(invite.team as { name?: string } | undefined)?.name ?? "a team"}"</span>
                </p>
                <div className="flex shrink-0 gap-3">
                  <button
                    disabled={isPending}
                    onClick={() => handleAccept(invite.id)}
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                  >
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleDecline(invite.id)}
                    className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {error && <div className="glass rounded-xl p-3 border border-red-400/30 text-red-400 text-sm">{error}</div>}
      {success && <div className="glass rounded-xl p-3 border border-green-400/30 text-green-400 text-sm">{success}</div>}

      {/* Tab bar */}
      <div className="relative mx-auto flex w-full max-w-fit flex-wrap justify-center gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl shadow-2xl">
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
            {t.label}
            {t.count != null && (
              <span className={cn(
                "ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px]",
                tab === t.id ? "bg-black/20 text-black" : "bg-white/10 text-gray-300"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-4 animate-slide-up">
          <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-black/60 p-8 shadow-2xl backdrop-blur-2xl sm:p-10">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-[100px]" />
            <div className="absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            
            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-red-300 shadow-neon">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Hackathon Hub
                </div>
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-2">
                    {eventHasStarted ? "Event status" : "Event starts in"}
                  </p>
                  <h2 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 sm:text-7xl drop-shadow-2xl">
                    {formatCountdown(event.start_time, now)}
                  </h2>
                  <div className="mt-4 flex items-center gap-3 text-sm font-medium text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-red-400" />
                      {event.start_time
                        ? `${eventHasStarted ? "Started" : "Starts"} ${formatEventDateTime(event.start_time, event.timezone)}`
                        : "Start time has not been set yet."}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-red-400" />
                      {plural(totalParticipants, "participant")} active
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={cn(
                "relative overflow-hidden rounded-3xl border px-6 py-5 shadow-2xl sm:min-w-56 backdrop-blur-md",
                formationOpen
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              )}>
                <div className={cn(
                  "absolute inset-0 opacity-20",
                  formationOpen ? "bg-[radial-gradient(circle_at_center,rgba(74,222,128,0.8)_0,transparent_100%)]" : "bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.8)_0,transparent_100%)]"
                )} />
                <div className="relative">
                  <div className={cn(
                    "flex items-center gap-2.5 text-[13px] font-black uppercase tracking-[0.2em]",
                    formationOpen ? "text-green-400" : "text-amber-400"
                  )}>
                    {formationOpen ? <Check className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    {formationOpen ? "Teams forming" : "Teams locked"}
                  </div>
                  <p className="mt-2 text-[12px] font-medium uppercase tracking-wider text-white/70">
                    {formationOpen && settings?.team_formation_closes_at
                      ? `Locks ${formatEventDateTime(settings.team_formation_closes_at, event.timezone)}`
                      : formationOpen
                        ? "Open for invites & changes"
                        : "Team changes are closed"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <HubMetric label="Teams Formed" value={allTeams.length} detail={`${plural(totalTeamMembers, "builder")} placed`} />
            <HubMetric label="Free Pool" value={pool.length} detail={formationOpen ? "Looking for teams" : "Unassigned"} />
            <HubMetric label="Submissions" value={submittedProjects} detail={`of ${plural(allTeams.length, "team")}`} />
            <HubMetric label="Open Slots" value={openTeamSlots} detail={`max ${maxTeamSize} per team`} muted={!formationOpen} />
          </div>

          <div className="relative overflow-hidden rounded-[34px] border border-red-500/20 bg-black/50 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-red-500/10" />
            <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-red-600/20 blur-[50px]" />
            
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-300">Mission Objective</p>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {myTeam
                    ? `You're on ${myTeam.name}`
                    : formationOpen
                      ? "Find or form your team"
                      : "Wait for organizer assignment"}
                </h3>
                <p className="max-w-2xl text-[15px] font-medium text-gray-400">
                  {myTeam
                    ? myTeam.project?.submitted_at
                      ? "Your project is submitted. Keep an eye on chat and the leaderboard."
                      : "Confirm your teammates, upload a team icon, and submit your project when ready."
                    : formationOpen
                      ? "Invite someone from the free pool or accept an invite to lock in your group."
                      : "Team formation has closed, but chat is still available for coordination."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <button
                  onClick={() => setTab(myTeam ? "my-team" : "open-pool")}
                  className="group relative overflow-hidden rounded-2xl bg-white px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.15em] text-black transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white via-red-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative">{myTeam ? "Open Team" : "Open Pool"}</span>
                </button>
                <button
                  onClick={() => setTab("chat")}
                  className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-white/10 hover:border-white/40"
                >
                  Comms
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TimelineItem
              label="Team Lock"
              value={settings?.team_formation_closes_at ? formatEventDateTime(settings.team_formation_closes_at, event.timezone) : "Not set"}
              active={formationOpen}
            />
            <TimelineItem
              label="Submissions"
              value={settings?.submission_deadline ? formatEventDateTime(settings.submission_deadline, event.timezone) : "Not set"}
            />
            <TimelineItem
              label="Judging"
              value={settings?.judging_starts_at ? formatEventDateTime(settings.judging_starts_at, event.timezone) : "Not set"}
            />
          </div>

          {(leaderboardVisible || leadingTeam) && (
            <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-[34px] border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
              <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-yellow-500/10 blur-[50px]" />
              
              <div className="relative flex items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)] overflow-hidden relative">
                  <div className="absolute inset-0 bg-yellow-500/10 animate-pulse" />
                  <img src="/cursor-logo.svg" alt="Cursor" className="w-7 h-7 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] brightness-200" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-500/80">Leaderboard</p>
                  <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-gray-300">
                    {leadingTeam
                      ? <><span className="text-white font-bold">{leadingTeam.name}</span> is currently leading with <span className="text-yellow-400 font-bold">{totalScore(leadingTeam.id, scores)}</span> points.</>
                      : "Leaderboard is visible once scores are available."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTab("all-teams")}
                className="relative shrink-0 rounded-[20px] border border-white/10 bg-white/5 px-6 py-3.5 text-[12px] font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 hover:border-white/30 hover:scale-105"
              >
                View Teams
              </button>
            </div>
          )}
        </div>
      )}

      {/* My Team tab */}
      {tab === "my-team" && (
        <div className="space-y-4 animate-slide-up">
          {!myTeam ? (
            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[60px]" />
              
              <div className="relative space-y-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-xl">
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tight text-white">You&apos;re not on a team yet</p>
                  {formationOpen ? (
                    <p className="mt-2 text-[15px] font-medium text-gray-400">
                      Go to <button onClick={() => setTab("open-pool")} className="text-red-400 hover:text-red-300 underline decoration-red-500/30 underline-offset-4 transition-colors">Open Pool</button> to find teammates and form a team
                    </p>
                  ) : (
                    <p className="mt-3 flex items-center justify-center gap-2 text-[13px] font-bold uppercase tracking-wider text-amber-500">
                      <Lock className="h-4 w-4" /> Team formation is closed
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-black/40 p-6 sm:p-10 backdrop-blur-xl shadow-2xl space-y-8">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/10 blur-[60px]" />
                
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-5 min-w-0">
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/15 bg-white/5 shadow-xl group">
                      {myTeam.icon_photo?.status === "approved" ? (
                        <Image
                          src={myTeam.icon_photo.file_url}
                          alt={`${myTeam.name} icon`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="80px"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0 pt-1">
                      <h2 className="text-4xl font-black tracking-tight truncate text-white drop-shadow-md">{myTeam.name}</h2>
                      <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {myTeam.members.length} member{myTeam.members.length !== 1 ? "s" : ""}
                        {teamLocked && (
                          <span className="ml-3 text-amber-500 inline-flex items-center gap-1.5">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </p>
                      {myTeam.icon_photo && myTeam.icon_photo.status !== "approved" && (
                        <p className={cn(
                          "mt-2 text-[11px] font-bold uppercase tracking-[0.2em]",
                          myTeam.icon_photo.status === "pending" ? "text-amber-400" : "text-red-400"
                        )}>
                          Team icon {myTeam.icon_photo.status === "pending" ? "pending approval" : "not approved"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 shrink-0 sm:flex-col sm:items-end">
                    <input
                      ref={teamIconInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        handleTeamIconUpload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      disabled={uploadingIcon}
                      onClick={() => teamIconInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      {uploadingIcon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      {myTeam.icon_photo ? "Replace Icon" : "Upload Icon"}
                    </button>
                    {!teamLocked && (
                      <button
                        disabled={isPending}
                        onClick={handleLeave}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <LogOut className="w-4 h-4" /> Leave
                      </button>
                    )}
                    {!teamLocked && (
                      <button
                        disabled={isPending}
                        onClick={handleDissolve}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="w-4 h-4" /> Dissolve
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative space-y-3">
                  {myTeam.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-[20px] border border-white/5 bg-white/[0.02] px-5 py-4 transition-colors hover:bg-white/[0.04]">
                      <span className="text-[16px] font-medium text-white">{m.user?.name ?? "Unknown"}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.2em] rounded-full px-3 py-1.5",
                        m.role === "leader"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30 shadow-neon"
                          : "bg-white/10 text-gray-400 border border-white/5"
                      )}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>

                {!teamLocked && myTeam.members.length < (settings?.max_team_size ?? 4) && (
                  <button
                    onClick={() => setTab("open-pool")}
                    className="relative w-full flex items-center justify-center gap-2.5 rounded-[20px] border border-dashed border-white/20 bg-white/[0.01] py-4 text-[14px] font-bold uppercase tracking-wider text-gray-400 transition-all hover:border-red-500/40 hover:bg-red-500/5 hover:text-red-300"
                  >
                    <UserPlus className="w-5 h-5" />
                    Invite from Open Pool
                  </button>
                )}
              </div>

              {/* Project submission */}
              <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
                
                <button
                  onClick={() => setShowProjectForm(!showProjectForm)}
                  className="relative w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 group-hover:bg-white/10 transition-colors">
                      <Globe className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-left text-[18px] font-bold text-white">
                        {myTeam.project?.submitted_at ? "Project Submitted" : "Submit Project"}
                      </h3>
                      {myTeam.project?.name && (
                        <p className="mt-1 text-left text-[13px] font-medium text-gray-400">{myTeam.project.name}</p>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all duration-300",
                    showProjectForm ? "rotate-180 bg-white/10" : "group-hover:bg-white/10"
                  )}>
                    <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white" />
                  </div>
                </button>

                {showProjectForm && (
                  <div className="relative space-y-5 mt-8 animate-fade-in border-t border-white/10 pt-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">Project Name *</label>
                      <input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="What are you building?"
                        className="w-full rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">Description</label>
                      <textarea
                        value={projectDesc}
                        onChange={(e) => setProjectDesc(e.target.value)}
                        rows={3}
                        placeholder="Brief description of your project..."
                        className="w-full resize-none rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1 flex items-center gap-1.5">
                          <Github className="w-3.5 h-3.5" /> Repo URL
                        </label>
                        <input
                          value={projectRepo}
                          onChange={(e) => setProjectRepo(e.target.value)}
                          placeholder="https://github.com/..."
                          className="w-full rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" /> Demo URL
                        </label>
                        <input
                          value={projectDemo}
                          onChange={(e) => setProjectDemo(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                      </div>
                    </div>
                    {/* Screenshots */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> Screenshots <span className="text-red-400/70 normal-case tracking-normal font-medium ml-2">({screenshots.length}/5) — used for AI judging</span>
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {screenshots.map((s) => (
                          <div key={s.id} className="relative w-24 h-24 rounded-[20px] overflow-hidden border border-white/10 bg-white/5 group shadow-lg">
                            <img src={s.file_url} alt="screenshot" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <button
                              onClick={() => handleScreenshotDelete(s.id)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/80 text-white">
                                <X className="w-4 h-4" />
                              </div>
                            </button>
                          </div>
                        ))}
                        {screenshots.length < 5 && (
                          <button
                            type="button"
                            disabled={uploadingScreenshot}
                            onClick={() => screenshotInputRef.current?.click()}
                            className="w-24 h-24 rounded-[20px] border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 flex items-center justify-center transition-all disabled:opacity-40 group"
                          >
                            {uploadingScreenshot
                              ? <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                              : <Camera className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />}
                          </button>
                        )}
                      </div>
                      <input
                        ref={screenshotInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleScreenshotUpload(e.target.files?.[0])}
                      />
                    </div>

                    <button
                      disabled={isPending || !projectName.trim()}
                      onClick={handleProjectSubmit}
                      className="relative w-full overflow-hidden rounded-[20px] bg-white py-4 text-[15px] font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white via-red-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="relative">{myTeam.project?.submitted_at ? "Update Project" : "Submit Project"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* AI analysis status card */}
              {teamAnalyses.length > 0 && (() => {
                const PASS_LABELS: Record<string, string> = {
                  pass1_repo: "Repo Analysis",
                  pass2_code: "Code Review",
                  pass3_innovation: "Innovation Check",
                  pass4_visual: "Visual Review",
                  pass5_pool: "Comparing with pool",
                  pass6_synthesis: "Final Synthesis",
                };
                const ORDER = ["pass1_repo", "pass2_code", "pass3_innovation", "pass4_visual", "pass5_pool", "pass6_synthesis"];
                const running = teamAnalyses.find((a) => a.status === "running");
                const completed = teamAnalyses.filter((a) => a.status === "complete");
                const allDone = completed.length === 6;
                const hasError = teamAnalyses.some((a) => a.status === "error");
                const scoresApplied = scores.some((s) => s.team_id === myTeam.id);

                if (scoresApplied) return null; // score card handles this

                return (
                  <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl space-y-4">
                    <div className="absolute inset-0 bg-grid-red/[0.02] bg-[size:20px_20px]" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`relative flex h-3 w-3 items-center justify-center`}>
                          {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>}
                          <span className={`relative inline-flex h-2 w-2 rounded-full ${running ? "bg-red-500" : allDone ? "bg-green-500" : hasError ? "bg-red-500" : "bg-gray-500"}`}></span>
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-300">AI Analysis</p>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        {allDone ? "Complete" : running ? `Pass ${ORDER.indexOf(running.pass_name) + 1}/6` : hasError ? "Error" : `${completed.length}/6`}
                      </span>
                    </div>

                    {/* Pass progress row */}
                    <div className="relative flex items-center gap-2">
                      {ORDER.map((passName, i) => {
                        const pass = teamAnalyses.find((a) => a.pass_name === passName);
                        const isRunning = pass?.status === "running";
                        const isDone = pass?.status === "complete";
                        const isError = pass?.status === "error";
                        return (
                          <div
                            key={passName}
                            title={PASS_LABELS[passName]}
                            className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                              isDone ? "bg-red-500 shadow-neon" :
                              isRunning ? "bg-red-500/50 animate-pulse shadow-neon" :
                              isError ? "bg-red-500/60 shadow-neon-red" :
                              "bg-white/5"
                            }`}
                          />
                        );
                      })}
                    </div>

                    <p className="relative text-[12px] font-medium text-gray-400 leading-relaxed">
                      {allDone
                        ? "Analysis complete — results pending admin review."
                        : running
                        ? `Currently running: ${PASS_LABELS[running.pass_name] ?? running.pass_name}…`
                        : hasError
                        ? "Analysis encountered an error — admin has been notified."
                        : "Analysis queued."}
                    </p>
                  </div>
                );
              })()}

              {/* Leaderboard (if visible) */}
              {leaderboardVisible && (
                <ScoreCard teamId={myTeam.id} scores={scores} />
              )}
            </>
          )}
        </div>
      )}

      {/* All Teams tab */}
      {tab === "all-teams" && (
        <div className="space-y-4 animate-slide-up">
          {allTeams.length === 0 && (
            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[60px]" />
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 mb-4 shadow-xl">
                  <Swords className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xl font-bold tracking-tight text-white">No teams formed yet — be the first!</p>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {leaderboardVisible
              ? [...allTeams].sort((a, b) => totalScore(b.id, scores) - totalScore(a.id, scores)).map((team, i) => (
                <TeamCard key={team.id} team={team} rank={i + 1} score={leaderboardVisible ? totalScore(team.id, scores) : null} formationOpen={formationOpen} />
              ))
              : allTeams.map((team) => (
                <TeamCard key={team.id} team={team} rank={null} score={null} formationOpen={formationOpen} />
              ))
            }
          </div>
        </div>
      )}

      {/* Open Pool tab */}
      {tab === "open-pool" && (
        <div className="space-y-4 animate-slide-up">
          {!formationOpen && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur-md">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.1)_0,transparent_100%)]" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[14px] font-bold uppercase tracking-wider text-amber-400">Formation Closed</p>
                  <p className="text-[13px] text-amber-200/80">Teams are locked and no new invites can be sent.</p>
                </div>
              </div>
            </div>
          )}

          {pool.length === 0 && (
            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[60px]" />
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 mb-4 shadow-xl">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xl font-bold tracking-tight text-white">Everyone is on a team!</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {pool.map((person) => {
              const alreadyInvited = sentIds.has(person.id);
              return (
                <div key={person.id} className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/40 p-5 backdrop-blur-xl transition-all hover:bg-white/[0.04] group">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-400 shadow-inner group-hover:border-red-500/30 group-hover:text-red-300 transition-colors">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[16px] font-bold text-white tracking-tight">{person.name}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Looking for team</p>
                      </div>
                    </div>
                    {formationOpen && (
                      alreadyInvited ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-green-400 shadow-neon-green">
                          <Check className="w-3 h-3" /> Invited
                        </span>
                      ) : (
                        <button
                          disabled={isPending}
                          onClick={() => setInviteTarget(person)}
                          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-200 hover:shadow-neon"
                        >
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setInviteTarget(null)} />
          <div className="relative overflow-hidden rounded-[34px] border border-red-500/30 bg-black/80 p-8 w-full max-w-md space-y-6 z-10 shadow-2xl backdrop-blur-xl">
            <div className="absolute inset-0 bg-grid-red/[0.02] bg-[size:20px_20px]" />
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-red-500/20 blur-[50px]" />
            
            <div className="relative">
              <h3 className="text-3xl font-black tracking-tight text-white drop-shadow-md">Invite {inviteTarget.name}</h3>
              
              {!myTeam && (
                <div className="mt-6 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">Team Name *</label>
                  <input
                    autoFocus
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Name your team..."
                    maxLength={60}
                    className="w-full rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                  />
                  <p className="text-[11px] font-medium text-gray-500 ml-1">You&apos;ll be set as team leader</p>
                </div>
              )}

              {myTeam && (
                <p className="mt-4 text-[15px] font-medium text-gray-300 bg-white/5 border border-white/10 rounded-2xl p-4">
                  Inviting to <span className="text-white font-bold">{myTeam.name}</span>
                </p>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  disabled={isPending || (!myTeam && !newTeamName.trim())}
                  onClick={handleSendInvite}
                  className="relative flex-1 overflow-hidden rounded-[20px] bg-white py-4 text-[14px] font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white via-red-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative">Send Invite</span>
                </button>
                <button
                  onClick={() => setInviteTarget(null)}
                  className="px-6 rounded-[20px] border border-white/10 bg-white/5 text-[14px] font-bold uppercase tracking-wider text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function HubMetric({
  label,
  value,
  detail,
  muted = false,
}: {
  label: string;
  value: number;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-[24px] border border-white/10 bg-black/40 p-5 backdrop-blur-xl transition-all hover:border-red-500/30 hover:bg-white/[0.04] group",
      muted && "opacity-60"
    )}>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-[40px] group-hover:bg-red-500/20 transition-all duration-500" />
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-red-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-300/70">{label}</p>
        <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{value}</p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">{detail}</p>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-md transition-all",
      active 
        ? "border-red-500/40 bg-red-500/[0.05] shadow-neon" 
        : "border-white/10 bg-black/40 hover:bg-white/[0.03]"
    )}>
      {active && (
        <div className="absolute inset-0 bg-grid-red/[0.05] bg-[size:20px_20px]" />
      )}
      <div className="relative flex items-center gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border",
          active ? "border-red-400/50 bg-red-500/20 text-red-200" : "border-white/10 bg-white/5 text-gray-400"
        )}>
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-[0.2em]",
            active ? "text-red-300" : "text-gray-500"
          )}>{label}</p>
          <p className="mt-0.5 text-[14px] font-medium text-gray-200">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, rank, score, formationOpen }: {
  team: HackathonTeamWithMembers;
  rank: number | null;
  score: number | null;
  formationOpen: boolean;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-[28px] border p-5 backdrop-blur-xl transition-all hover:bg-white/[0.04] group",
      rank === 1 ? "border-yellow-500/30 bg-yellow-500/[0.02]" : "border-white/10 bg-black/40"
    )}>
      {rank === 1 && (
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-yellow-500/10 blur-[40px]" />
      )}
      
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          {rank != null && (
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-black shadow-neon",
              rank === 1 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
              rank === 2 ? "bg-gray-400/10 text-gray-300 border border-gray-400/20" :
              rank === 3 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
              "bg-white/5 text-gray-500 border border-white/10"
            )}>
              {rank}
            </div>
          )}
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg group-hover:border-red-500/30 transition-colors">
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
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{team.name}</h3>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}
              {!formationOpen && <span className="ml-2 text-amber-500">· Locked</span>}
            </p>
          </div>
        </div>
        {score != null && (
          <div className="shrink-0 text-right">
            <p className="text-3xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{score}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">/ 40 pts</p>
          </div>
        )}
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {team.members.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-gray-300">
            {m.user?.name ?? "Unknown"}
            {m.role === "leader" && <span className="text-red-400">★</span>}
          </span>
        ))}
      </div>

      {team.project && (
        <div className="relative mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-[14px] font-medium text-gray-300 truncate">{team.project.name}</p>
          <div className="flex shrink-0 gap-2">
            {team.project.repo_url && (
              <a href={team.project.repo_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300">
                <Github className="h-3.5 w-3.5" /> Repo
              </a>
            )}
            {team.project.demo_url && (
              <a href={team.project.demo_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-green-400 transition-colors hover:bg-green-500/10 hover:text-green-300">
                <ExternalLink className="h-3.5 w-3.5" /> Demo
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ teamId, scores }: { teamId: string; scores: HackathonScore[] }) {
  const teamScores = scores.filter((s) => s.team_id === teamId);
  if (!teamScores.length) return null;
  const cats = [
    { key: "innovation" as const, label: "Innovation" },
    { key: "execution" as const, label: "Execution" },
    { key: "presentation" as const, label: "Presentation" },
    { key: "ux_polish" as const, label: "UX / Polish" },
  ];
  const avg = (key: typeof cats[0]["key"]) => {
    const vals = teamScores.map((s) => s[key]).filter((v) => v != null) as number[];
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  const total = cats.reduce((sum, c) => sum + (avg(c.key) ?? 0), 0);
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-red-500/20 bg-black/40 p-6 backdrop-blur-xl shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/10 blur-[40px]" />
      
      <div className="relative flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-red-300">Your Score</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black tracking-tight text-white drop-shadow-md">{total}</span>
          <span className="text-sm font-bold text-gray-500">/40</span>
        </div>
      </div>
      <div className="relative space-y-4">
        {cats.map((c) => {
          const v = avg(c.key);
          return (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-300">{c.label}</span>
              <div className="flex items-center gap-4">
                <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-300 rounded-full shadow-neon" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                </div>
                <span className="text-[14px] font-bold tabular-nums text-white w-6 text-right">{v ?? "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
