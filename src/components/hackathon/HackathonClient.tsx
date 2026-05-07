"use client";

import React, { useState, useTransition, useEffect, useCallback, useRef } from "react";
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
  HackathonChatChannel, HackathonChatMessage, ChatMember,
} from "@/types";
import { HackathonChat } from "@/components/hackathon-chat/HackathonChat";

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
}

type Tab = "my-team" | "all-teams" | "open-pool" | "chat";

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

export function HackathonClient({
  event, userId, isAdmin, settings, myTeam: initialMyTeam,
  receivedInvites: initialInvites, sentInviteUserIds: initialSent,
  allTeams: initialAllTeams, openPool: initialPool, scores,
  chatChannels, initialMessages, initialChannelId, chatMembers,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>(initialMyTeam ? "my-team" : "open-pool");

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

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formationOpen = isFormationOpen(settings);
  const teamLocked = !formationOpen;
  const leaderboardVisible = settings?.leaderboard_visible ?? false;

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
    { id: "my-team", label: "My Team" },
    { id: "all-teams", label: "All Teams", count: allTeams.length },
    { id: "open-pool", label: "Pool", count: pool.length },
    { id: "chat", label: "Chat", icon: <MessageSquare className="w-3 h-3" /> },
  ];

  // Chat tab: full-width layout, skip the narrow container
  if (tab === "chat") {
    return (
      <main className="px-2 py-4 w-full animate-fade-in">
        {/* Tab bar — stays above chat */}
        <div className="glass rounded-[24px] p-1.5 flex gap-1.5 mb-4 max-w-2xl mx-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 py-2.5 px-2 rounded-[18px] text-xs font-medium uppercase tracking-[0.12em] transition-all duration-200 flex items-center justify-center gap-1.5",
                t.id === tab
                  ? "bg-white text-black shadow-glow scale-105"
                  : "text-gray-500 hover:text-white bg-white/5"
              )}
            >
              {t.icon}
              {t.label}
              {t.count != null && (
                <span className={cn(
                  "text-[9px] rounded-full px-1.5 py-0.5",
                  t.id === tab ? "bg-black/10 text-black" : "bg-white/10 text-gray-400"
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
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 w-full animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Swords className="w-6 h-6 text-purple-400" />
        <div>
          <h1 className="text-2xl font-light tracking-tight">Hackathon</h1>
          {settings?.team_formation_closes_at && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3" />
              {formationOpen
                ? `Teams lock ${new Date(settings.team_formation_closes_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Team formation closed"}
            </p>
          )}
        </div>
      </div>

      {/* Pending invite banners */}
      {receivedInvites.length > 0 && (
        <div className="space-y-3">
          {receivedInvites.map((invite) => (
            <div key={invite.id} className="glass rounded-2xl p-4 border border-purple-400/30 bg-purple-400/5">
              <p className="text-sm text-white/90">
                <span className="font-medium">{(invite.inviter as { name?: string } | undefined)?.name ?? "Someone"}</span>
                {" invited you to join "}
                <span className="font-medium">"{(invite.team as { name?: string } | undefined)?.name ?? "a team"}"</span>
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  disabled={isPending}
                  onClick={() => handleAccept(invite.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-white/90 transition-all"
                >
                  <Check className="w-3 h-3" /> Accept
                </button>
                <button
                  disabled={isPending}
                  onClick={() => handleDecline(invite.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-3 h-3" /> Decline
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
      <div className="glass rounded-[24px] p-1.5 flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-2.5 px-2 rounded-[18px] text-xs font-medium uppercase tracking-[0.12em] transition-all duration-200 flex items-center justify-center gap-1.5",
              tab === t.id
                ? "bg-white text-black shadow-glow scale-105"
                : "text-gray-500 hover:text-white bg-white/5"
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className={cn(
                "text-[9px] rounded-full px-1.5 py-0.5",
                tab === t.id ? "bg-black/10 text-black" : "bg-white/10 text-gray-400"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Team tab */}
      {tab === "my-team" && (
        <div className="space-y-4 animate-slide-up">
          {!myTeam ? (
            <div className="glass rounded-[32px] p-10 border-white/20 text-center space-y-4">
              <Users className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-gray-400 text-sm">You&apos;re not on a team yet</p>
              {formationOpen ? (
                <p className="text-[11px] text-gray-600">
                  Go to <button onClick={() => setTab("open-pool")} className="text-white underline">Open Pool</button> to find teammates and form a team
                </p>
              ) : (
                <p className="text-[11px] text-amber-400/80 flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3" /> Team formation is closed
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="glass rounded-[32px] p-8 border-white/20 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="relative w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {myTeam.icon_photo?.status === "approved" ? (
                        <Image
                          src={myTeam.icon_photo.file_url}
                          alt={`${myTeam.name} icon`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-light truncate">{myTeam.name}</h2>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
                        {myTeam.members.length} member{myTeam.members.length !== 1 ? "s" : ""}
                        {teamLocked && (
                          <span className="ml-3 text-amber-400 flex items-center gap-1 inline-flex">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </p>
                      {myTeam.icon_photo && myTeam.icon_photo.status !== "approved" && (
                        <p className={cn(
                          "text-[10px] uppercase tracking-[0.18em] mt-2",
                          myTeam.icon_photo.status === "pending" ? "text-amber-400" : "text-red-400"
                        )}>
                          Team icon {myTeam.icon_photo.status === "pending" ? "pending approval" : "not approved"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
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
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-white border border-white/5 hover:border-white/20 transition-all disabled:opacity-50"
                    >
                      {uploadingIcon ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      {myTeam.icon_photo ? "Replace Icon" : "Upload Icon"}
                    </button>
                    {!teamLocked && (
                      <button
                        disabled={isPending}
                        onClick={handleLeave}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 border border-white/5 hover:border-red-400/30 transition-all"
                      >
                        <LogOut className="w-3 h-3" /> Leave
                      </button>
                    )}
                    <button
                      disabled={isPending}
                      onClick={handleDissolve}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 border border-white/5 hover:border-red-400/30 transition-all"
                    >
                      <X className="w-3 h-3" /> Dissolve
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {myTeam.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-sm">{m.user?.name ?? "Unknown"}</span>
                      <span className={cn(
                        "text-[9px] uppercase tracking-[0.15em] rounded-full px-2 py-0.5",
                        m.role === "leader"
                          ? "bg-purple-400/10 text-purple-400"
                          : "bg-white/5 text-gray-500"
                      )}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>

                {!teamLocked && myTeam.members.length < (settings?.max_team_size ?? 4) && (
                  <button
                    onClick={() => setTab("open-pool")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-white/20 text-gray-500 hover:text-white hover:border-white/40 transition-all text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite from Open Pool
                  </button>
                )}
              </div>

              {/* Project submission */}
              <div className="glass rounded-[32px] p-6 border-white/20">
                <button
                  onClick={() => setShowProjectForm(!showProjectForm)}
                  className="w-full flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-sm font-medium text-left">
                      {myTeam.project?.submitted_at ? "Project Submitted" : "Submit Project"}
                    </h3>
                    {myTeam.project?.name && (
                      <p className="text-[11px] text-gray-400 mt-0.5 text-left">{myTeam.project.name}</p>
                    )}
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", showProjectForm && "rotate-180")} />
                </button>

                {showProjectForm && (
                  <div className="space-y-4 mt-6 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Project Name *</label>
                      <input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="What are you building?"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Description</label>
                      <textarea
                        value={projectDesc}
                        onChange={(e) => setProjectDesc(e.target.value)}
                        rows={3}
                        placeholder="Brief description of your project..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5">
                          <Github className="w-3 h-3" /> Repo URL
                        </label>
                        <input
                          value={projectRepo}
                          onChange={(e) => setProjectRepo(e.target.value)}
                          placeholder="https://github.com/..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5">
                          <Globe className="w-3 h-3" /> Demo URL
                        </label>
                        <input
                          value={projectDemo}
                          onChange={(e) => setProjectDemo(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                    <button
                      disabled={isPending || !projectName.trim()}
                      onClick={handleProjectSubmit}
                      className="w-full py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40"
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
            <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
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
            <div className="glass rounded-2xl p-4 border border-amber-400/20 bg-amber-400/5 flex items-center gap-3">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-400/80">Team formation is closed — teams are locked</p>
            </div>
          )}

          {pool.length === 0 && (
            <div className="glass rounded-[32px] p-12 border-white/20 text-center text-gray-500">
              Everyone is on a team!
            </div>
          )}

          {pool.map((person) => {
            const alreadyInvited = sentIds.has(person.id);
            return (
              <div key={person.id} className="glass rounded-2xl p-4 border-white/20 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{person.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mt-0.5">Looking for team</p>
                </div>
                {formationOpen && (
                  alreadyInvited ? (
                    <span className="text-[10px] uppercase tracking-[0.15em] text-gray-600 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-green-500" /> Invited
                    </span>
                  ) : (
                    <button
                      disabled={isPending}
                      onClick={() => setInviteTarget(person)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 text-sm transition-all"
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
          <div className="relative glass rounded-[32px] p-8 border-white/20 w-full max-w-sm space-y-5 z-10">
            <h3 className="text-lg font-light">Invite {inviteTarget.name}</h3>

            {!myTeam && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Team Name *</label>
                <input
                  autoFocus
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Name your team..."
                  maxLength={60}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                />
                <p className="text-[10px] text-gray-600">You&apos;ll be set as team leader</p>
              </div>
            )}

            {myTeam && (
              <p className="text-sm text-gray-400">
                Inviting to <span className="text-white font-medium">{myTeam.name}</span>
              </p>
            )}

            <div className="flex gap-3">
              <button
                disabled={isPending || (!myTeam && !newTeamName.trim())}
                onClick={handleSendInvite}
                className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40"
              >
                Send Invite
              </button>
              <button
                onClick={() => setInviteTarget(null)}
                className="px-4 rounded-2xl border border-white/10 text-gray-400 hover:text-white transition-all"
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

function TeamCard({ team, rank, score, formationOpen }: {
  team: HackathonTeamWithMembers;
  rank: number | null;
  score: number | null;
  formationOpen: boolean;
}) {
  return (
    <div className={cn(
      "glass rounded-[24px] p-5 border-white/20 space-y-3",
      rank === 1 && "border-yellow-400/20 bg-yellow-400/5"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {rank != null && (
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-light shrink-0",
              rank === 1 ? "bg-yellow-400/20 text-yellow-400" :
              rank === 2 ? "bg-gray-400/10 text-gray-300" :
              rank === 3 ? "bg-orange-400/10 text-orange-400" :
              "bg-white/5 text-gray-500"
            )}>
              {rank}
            </div>
          )}
          <div className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
            {team.icon_photo?.status === "approved" ? (
              <Image
                src={team.icon_photo.file_url}
                alt={`${team.name} icon`}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <ImageIcon className="w-4 h-4 text-gray-600" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium">{team.name}</h3>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-0.5">
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}
              {!formationOpen && <span className="ml-2 text-amber-400">· Locked</span>}
            </p>
          </div>
        </div>
        {score != null && (
          <div className="text-right shrink-0">
            <p className="text-xl font-light tabular-nums">{score}</p>
            <p className="text-[9px] text-gray-600">/ 40</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {team.members.map((m) => (
          <span key={m.id} className="text-[11px] bg-white/5 border border-white/5 rounded-full px-2.5 py-1 text-gray-300">
            {m.user?.name ?? "Unknown"}
            {m.role === "leader" && <span className="text-purple-400/60 ml-1">★</span>}
          </span>
        ))}
      </div>

      {team.project && (
        <div className="border-t border-white/5 pt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-300 truncate">{team.project.name}</p>
          <div className="flex gap-3 shrink-0">
            {team.project.repo_url && (
              <a href={team.project.repo_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-[0.15em] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Github className="w-3 h-3" /> Repo
              </a>
            )}
            {team.project.demo_url && (
              <a href={team.project.demo_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-[0.15em] text-green-400 hover:text-green-300 flex items-center gap-1">
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
    <div className="glass rounded-[28px] p-6 border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-400">Your Score</h3>
        <span className="text-2xl font-light">{total}<span className="text-sm text-gray-600">/40</span></span>
      </div>
      <div className="space-y-3">
        {cats.map((c) => {
          const v = avg(c.key);
          return (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{c.label}</span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums text-white/60 w-6 text-right">{v ?? "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
