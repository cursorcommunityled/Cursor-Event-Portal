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
  initialScreenshots?: { id: string; file_url: string }[];
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
  publishedJudgingResults, initialScreenshots = [],
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

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
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
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [event.id, userId, refresh]);

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
    <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-white/[0.035] px-5 py-4 shadow-glow backdrop-blur-3xl sm:px-6 sm:py-5">
      <div className="absolute -left-10 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-400/15 shadow-[0_0_24px_rgba(168,85,247,0.18)]">
          <Swords className="h-6 w-6 text-purple-200" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/90">
            Build Sprint
          </p>
          <h1 className="mt-0.5 truncate text-3xl font-light tracking-tight text-white text-shadow-glow sm:text-4xl">
            Hackathon
          </h1>
          <p className="mt-1 truncate text-sm leading-relaxed text-gray-300 sm:text-[15px]">
            {event.name}
          </p>
          {settings?.team_formation_closes_at && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
              <Clock className="h-3.5 w-3.5 text-purple-200/80" />
              {formationOpen
                ? `Teams lock ${new Date(settings.team_formation_closes_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Team formation closed"}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Chat tab: full-width layout, skip the narrow container
  if (tab === "chat") {
    return (
      <main className="px-3 py-5 w-full animate-fade-in md:pl-40 md:pr-6">
        <div className="mb-5 max-w-5xl mx-auto">
          {header}
        </div>
        {/* Tab bar — stays above chat */}
        <div className="glass mb-5 grid max-w-5xl grid-cols-5 gap-1.5 rounded-[26px] border-white/15 bg-white/[0.03] p-1.5 shadow-glow mx-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex min-h-12 items-center justify-center gap-1.5 rounded-[20px] px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-all duration-200 sm:text-[12px]",
                t.id === tab
                  ? "bg-white text-black shadow-glow scale-[1.02]"
                  : "text-gray-300 hover:text-white bg-white/[0.045] hover:bg-white/[0.08]"
              )}
            >
              {t.icon}
              {t.label}
              {t.count != null && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  t.id === tab ? "bg-black/10 text-black" : "bg-white/10 text-gray-300"
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
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 animate-fade-in sm:px-6 sm:py-10">

      {/* Header */}
      {header}

      <JudgingWinnersPodium results={publishedJudgingResults} />

      {/* Pending invite banners */}
      {receivedInvites.length > 0 && (
        <div className="space-y-3">
          {receivedInvites.map((invite) => (
            <div key={invite.id} className="glass rounded-3xl p-5 border border-purple-300/30 bg-purple-400/[0.08]">
              <p className="text-[15px] leading-relaxed text-white/95">
                <span className="font-medium">{(invite.inviter as { name?: string } | undefined)?.name ?? "Someone"}</span>
                {" invited you to join "}
                <span className="font-medium">"{(invite.team as { name?: string } | undefined)?.name ?? "a team"}"</span>
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  disabled={isPending}
                  onClick={() => handleAccept(invite.id)}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition-all hover:bg-white/90"
                >
                  <Check className="w-3.5 h-3.5" /> Accept
                </button>
                <button
                  disabled={isPending}
                  onClick={() => handleDecline(invite.id)}
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[13px] text-gray-300 transition-all hover:text-white"
                >
                  <X className="w-3.5 h-3.5" /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {error && <div className="glass rounded-xl p-3 border border-red-400/30 text-red-400 text-sm">{error}</div>}
      {success && <div className="glass rounded-xl p-3 border border-green-400/30 text-green-400 text-sm">{success}</div>}

      {/* Tab bar */}
      <div className="glass grid grid-cols-5 gap-1.5 rounded-[26px] border-white/15 bg-white/[0.03] p-1.5 shadow-glow">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-1.5 rounded-[20px] px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-all duration-200 sm:text-[12px]",
              tab === t.id
                ? "bg-white text-black shadow-glow scale-[1.02]"
                : "text-gray-300 hover:text-white bg-white/[0.045] hover:bg-white/[0.08]"
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px]",
                tab === t.id ? "bg-black/10 text-black" : "bg-white/10 text-gray-300"
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
          <div className="glass relative overflow-hidden rounded-[40px] border border-white/20 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-purple-500/[0.06] p-6 shadow-[0_30px_80px_-35px_rgba(168,85,247,0.45)] sm:p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-400/15 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-400/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-300 shadow-[0_0_10px_rgba(216,180,254,0.8)]" />
                  Hackathon Hub
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                    {eventHasStarted ? "Event status" : "Event starts in"}
                  </p>
                  <h2 className="mt-1 text-5xl font-light tracking-tight text-white text-shadow-glow sm:text-6xl">
                    {formatCountdown(event.start_time, now)}
                  </h2>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-300">
                    {event.start_time
                      ? `${eventHasStarted ? "Started" : "Starts"} ${formatEventDateTime(event.start_time, event.timezone)}`
                      : "Start time has not been set yet."}
                    {" · "}
                    {plural(totalParticipants, "participant")} active
                  </p>
                </div>
              </div>
              <div className={cn(
                "rounded-3xl border px-4 py-3 text-[15px] shadow-inner-glow sm:min-w-48",
                formationOpen
                  ? "border-green-400/20 bg-green-400/10 text-green-300"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-300"
              )}>
                <div className="flex items-center gap-2 font-semibold">
                  {formationOpen ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {formationOpen ? "Teams forming" : "Teams locked"}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">
                  {formationOpen && settings?.team_formation_closes_at
                    ? `Locks ${formatEventDateTime(settings.team_formation_closes_at, event.timezone)}`
                    : formationOpen
                      ? "Open for invites and team changes"
                      : "Team changes are closed"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <HubMetric label="Teams Formed" value={allTeams.length} detail={`${plural(totalTeamMembers, "builder")} placed`} />
            <HubMetric label="Free Pool" value={pool.length} detail={formationOpen ? "Looking for teams" : "Unassigned"} />
            <HubMetric label="Submissions" value={submittedProjects} detail={`of ${plural(allTeams.length, "team")}`} />
            <HubMetric label="Open Slots" value={openTeamSlots} detail={`max ${maxTeamSize} per team`} muted={!formationOpen} />
          </div>

          <div className="glass rounded-[34px] border border-white/15 bg-white/[0.025] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">Your next move</p>
                <h3 className="text-xl font-light text-white sm:text-2xl">
                  {myTeam
                    ? `You're on ${myTeam.name}`
                    : formationOpen
                      ? "Find or form your team"
                      : "Wait for organizer assignment"}
                </h3>
                <p className="max-w-2xl text-[15px] leading-relaxed text-gray-300">
                  {myTeam
                    ? myTeam.project?.submitted_at
                      ? "Your project is submitted. Keep an eye on chat and the leaderboard."
                      : "Confirm your teammates, upload a team icon, and submit your project when ready."
                    : formationOpen
                      ? "Invite someone from the free pool or accept an invite to lock in your group."
                      : "Team formation has closed, but chat is still available for coordination."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={() => setTab(myTeam ? "my-team" : "open-pool")}
                  className="rounded-2xl bg-white px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black transition-all hover:bg-white/90 hover:shadow-glow"
                >
                  {myTeam ? "Open Team" : "Open Pool"}
                </button>
                <button
                  onClick={() => setTab("chat")}
                  className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-200 transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
                >
                  Chat
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
            <div className="glass flex items-center justify-between gap-4 rounded-[30px] border border-white/15 bg-white/[0.025] p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">Leaderboard</p>
                <p className="mt-1 text-[15px] leading-relaxed text-gray-300">
                  {leadingTeam
                    ? `${leadingTeam.name} is currently leading with ${totalScore(leadingTeam.id, scores)} points.`
                    : "Leaderboard is visible once scores are available."}
                </p>
              </div>
              <button
                onClick={() => setTab("all-teams")}
                className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-200 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
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
            <div className="glass rounded-[34px] p-10 border-white/20 bg-white/[0.02] text-center space-y-4">
              <Users className="w-11 h-11 text-gray-400 mx-auto" />
              <p className="text-[16px] text-gray-200">You&apos;re not on a team yet</p>
              {formationOpen ? (
                <p className="text-[13px] text-gray-400">
                  Go to <button onClick={() => setTab("open-pool")} className="text-white underline">Open Pool</button> to find teammates and form a team
                </p>
              ) : (
                <p className="text-[13px] text-amber-300 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Team formation is closed
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="glass rounded-[34px] p-6 border-white/20 bg-white/[0.02] space-y-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] shadow-inner-glow">
                      {myTeam.icon_photo?.status === "approved" ? (
                        <Image
                          src={myTeam.icon_photo.file_url}
                          alt={`${myTeam.name} icon`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-3xl font-light truncate text-white">{myTeam.name}</h2>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 mt-1.5">
                        {myTeam.members.length} member{myTeam.members.length !== 1 ? "s" : ""}
                        {teamLocked && (
                          <span className="ml-3 text-amber-400 flex items-center gap-1 inline-flex">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </p>
                      {myTeam.icon_photo && myTeam.icon_photo.status !== "approved" && (
                        <p className={cn(
                          "text-[11px] font-medium uppercase tracking-[0.18em] mt-2",
                          myTeam.icon_photo.status === "pending" ? "text-amber-400" : "text-red-400"
                        )}>
                          Team icon {myTeam.icon_photo.status === "pending" ? "pending approval" : "not approved"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 sm:flex-col sm:items-end">
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
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-gray-300 transition-all hover:border-white/25 hover:text-white disabled:opacity-50"
                    >
                      {uploadingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      {myTeam.icon_photo ? "Replace Icon" : "Upload Icon"}
                    </button>
                    {!teamLocked && (
                      <button
                        disabled={isPending}
                        onClick={handleLeave}
                        className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-gray-300 transition-all hover:border-red-400/30 hover:text-red-300"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Leave
                      </button>
                    )}
                    <button
                      disabled={isPending}
                      onClick={handleDissolve}
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-gray-300 transition-all hover:border-red-400/30 hover:text-red-300"
                    >
                      <X className="w-3.5 h-3.5" /> Dissolve
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {myTeam.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 last:border-white/[0.06]">
                      <span className="text-[15px] text-gray-100">{m.user?.name ?? "Unknown"}</span>
                      <span className={cn(
                        "text-[10px] uppercase tracking-[0.15em] rounded-full px-2.5 py-1",
                        m.role === "leader"
                          ? "bg-purple-400/15 text-purple-200"
                          : "bg-white/[0.07] text-gray-300"
                      )}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>

                {!teamLocked && myTeam.members.length < (settings?.max_team_size ?? 4) && (
                  <button
                    onClick={() => setTab("open-pool")}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 py-3 text-[15px] text-gray-300 transition-all hover:border-white/45 hover:bg-white/[0.04] hover:text-white"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite from Open Pool
                  </button>
                )}
              </div>

              {/* Project submission */}
              <div className="glass rounded-[34px] p-6 border-white/20 bg-white/[0.02]">
                <button
                  onClick={() => setShowProjectForm(!showProjectForm)}
                  className="w-full flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-left text-[16px] font-medium text-white">
                      {myTeam.project?.submitted_at ? "Project Submitted" : "Submit Project"}
                    </h3>
                    {myTeam.project?.name && (
                      <p className="mt-1 text-left text-[13px] text-gray-300">{myTeam.project.name}</p>
                    )}
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-300 transition-transform", showProjectForm && "rotate-180")} />
                </button>

                {showProjectForm && (
                  <div className="space-y-4 mt-6 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Project Name *</label>
                      <input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="What are you building?"
                        className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder-gray-500 focus:outline-none focus:border-white/35"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Description</label>
                      <textarea
                        value={projectDesc}
                        onChange={(e) => setProjectDesc(e.target.value)}
                        rows={3}
                        placeholder="Brief description of your project..."
                        className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder-gray-500 focus:outline-none focus:border-white/35"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
                          <Github className="w-3 h-3" /> Repo URL
                        </label>
                        <input
                          value={projectRepo}
                          onChange={(e) => setProjectRepo(e.target.value)}
                          placeholder="https://github.com/..."
                          className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder-gray-500 focus:outline-none focus:border-white/35"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
                          <Globe className="w-3 h-3" /> Demo URL
                        </label>
                        <input
                          value={projectDemo}
                          onChange={(e) => setProjectDemo(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder-gray-500 focus:outline-none focus:border-white/35"
                        />
                      </div>
                    </div>
                    {/* Screenshots */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
                        <Camera className="w-3 h-3" /> Screenshots <span className="text-gray-600 normal-case tracking-normal font-normal">({screenshots.length}/5) — used for AI judging</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {screenshots.map((s) => (
                          <div key={s.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
                            <img src={s.file_url} alt="screenshot" className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleScreenshotDelete(s.id)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ))}
                        {screenshots.length < 5 && (
                          <button
                            type="button"
                            disabled={uploadingScreenshot}
                            onClick={() => screenshotInputRef.current?.click()}
                            className="w-20 h-20 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-40"
                          >
                            {uploadingScreenshot
                              ? <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                              : <Camera className="w-4 h-4 text-gray-500" />}
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
                      className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black transition-all hover:bg-white/90 hover:shadow-glow disabled:opacity-40"
                    >
                      {myTeam.project?.submitted_at ? "Update Project" : "Submit Project"}
                    </button>
                  </div>
                )}
              </div>

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
            <div className="glass rounded-[34px] p-12 border-white/20 bg-white/[0.02] text-center text-[16px] text-gray-300">
              No teams formed yet — be the first!
            </div>
          )}
          {leaderboardVisible
            ? [...allTeams].sort((a, b) => totalScore(b.id, scores) - totalScore(a.id, scores)).map((team, i) => (
              <TeamCard key={team.id} team={team} rank={i + 1} score={leaderboardVisible ? totalScore(team.id, scores) : null} formationOpen={formationOpen} />
            ))
            : allTeams.map((team) => (
              <TeamCard key={team.id} team={team} rank={null} score={null} formationOpen={formationOpen} />
            ))
          }
        </div>
      )}

      {/* Open Pool tab */}
      {tab === "open-pool" && (
        <div className="space-y-4 animate-slide-up">
          {!formationOpen && (
            <div className="glass rounded-2xl p-4 border border-amber-400/25 bg-amber-400/[0.07] flex items-center gap-3">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-[15px] text-amber-200">Team formation is closed — teams are locked</p>
            </div>
          )}

          {pool.length === 0 && (
            <div className="glass rounded-[34px] p-12 border-white/20 bg-white/[0.02] text-center text-[16px] text-gray-300">
              Everyone is on a team!
            </div>
          )}

          {pool.map((person) => {
            const alreadyInvited = sentIds.has(person.id);
            return (
              <div key={person.id} className="glass rounded-3xl p-5 border-white/20 bg-white/[0.02] flex items-center justify-between gap-4">
                <div>
                  <p className="text-[16px] font-medium text-white">{person.name}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Looking for team</p>
                </div>
                {formationOpen && (
                  alreadyInvited ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-green-500" /> Invited
                    </span>
                  ) : (
                    <button
                      disabled={isPending}
                      onClick={() => setInviteTarget(person)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 hover:bg-white/[0.14] text-[15px] transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Invite
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite modal */}
      {inviteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setInviteTarget(null)} />
          <div className="relative glass rounded-[34px] p-8 border-white/20 bg-black/70 w-full max-w-md space-y-5 z-10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
            <h3 className="text-2xl font-light text-white">Invite {inviteTarget.name}</h3>

            {!myTeam && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Team Name *</label>
                <input
                  autoFocus
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Name your team..."
                  maxLength={60}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-[15px] text-white placeholder-gray-500 focus:outline-none focus:border-white/35"
                />
                <p className="text-[12px] text-gray-400">You&apos;ll be set as team leader</p>
              </div>
            )}

            {myTeam && (
              <p className="text-[15px] text-gray-300">
                Inviting to <span className="text-white font-medium">{myTeam.name}</span>
              </p>
            )}

            <div className="flex gap-3">
              <button
                disabled={isPending || (!myTeam && !newTeamName.trim())}
                onClick={handleSendInvite}
                className="flex-1 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black transition-all hover:bg-white/90 disabled:opacity-40"
              >
                Send Invite
              </button>
              <button
                onClick={() => setInviteTarget(null)}
                className="px-5 rounded-2xl border border-white/15 text-[15px] text-gray-300 hover:text-white transition-all"
              >
                Cancel
              </button>
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
      "glass rounded-[26px] border border-white/15 bg-white/[0.025] p-4 shadow-inner-glow",
      muted && "opacity-55"
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className="mt-2 text-4xl font-light tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-gray-300">{detail}</p>
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
      "rounded-3xl border bg-white/[0.035] p-4 shadow-inner-glow",
      active ? "border-purple-300/25" : "border-white/10"
    )}>
      <div className="flex items-center gap-2">
        <Clock className={cn("h-3.5 w-3.5", active ? "text-purple-200" : "text-gray-400")} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      </div>
      <p className="mt-2 text-[15px] leading-snug text-gray-200">{value}</p>
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
      "glass rounded-[28px] p-5 border-white/20 bg-white/[0.02] space-y-4",
      rank === 1 && "border-yellow-400/20 bg-yellow-400/5"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {rank != null && (
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-light shrink-0",
              rank === 1 ? "bg-yellow-400/20 text-yellow-400" :
              rank === 2 ? "bg-gray-400/10 text-gray-300" :
              rank === 3 ? "bg-orange-400/10 text-orange-400" :
              "bg-white/5 text-gray-400"
            )}>
              {rank}
            </div>
          )}
          <div className="relative w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/15 overflow-hidden shrink-0 flex items-center justify-center">
            {team.icon_photo?.status === "approved" ? (
              <Image
                src={team.icon_photo.file_url}
                alt={`${team.name} icon`}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <ImageIcon className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="text-[16px] font-medium text-white">{team.name}</h3>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}
              {!formationOpen && <span className="ml-2 text-amber-400">· Locked</span>}
            </p>
          </div>
        </div>
        {score != null && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-light tabular-nums text-white">{score}</p>
            <p className="text-[10px] text-gray-400">/ 40</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {team.members.map((m) => (
          <span key={m.id} className="text-[12px] bg-white/[0.07] border border-white/10 rounded-full px-3 py-1.5 text-gray-200">
            {m.user?.name ?? "Unknown"}
            {m.role === "leader" && <span className="text-purple-400/60 ml-1">★</span>}
          </span>
        ))}
      </div>

      {team.project && (
        <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-2">
          <p className="text-[14px] text-gray-200 truncate">{team.project.name}</p>
          <div className="flex gap-3 shrink-0">
            {team.project.repo_url && (
              <a href={team.project.repo_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-300 hover:text-blue-200 flex items-center gap-1">
                <Github className="w-3 h-3" /> Repo
              </a>
            )}
            {team.project.demo_url && (
              <a href={team.project.demo_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-green-300 hover:text-green-200 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Demo
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
    <div className="glass rounded-[30px] p-6 border-white/20 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400">Your Score</h3>
        <span className="text-3xl font-light text-white">{total}<span className="text-sm text-gray-400">/40</span></span>
      </div>
      <div className="space-y-3">
        {cats.map((c) => {
          const v = avg(c.key);
          return (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-[13px] text-gray-300">{c.label}</span>
              <div className="flex items-center gap-3">
                <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white/75 rounded-full" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                </div>
                <span className="text-[13px] tabular-nums text-white/75 w-6 text-right">{v ?? "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
