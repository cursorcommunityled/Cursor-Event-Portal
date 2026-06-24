"use client";

import React, { useState, useTransition, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendTeamInvite,
  createSoloTeam,
  startSoloHackathonTeam,
  cancelTeamInvite,
  acceptTeamInvite,
  declineTeamInvite,
  renameTeam,
  leaveTeam,
  dissolveTeam,
  submitHackathonProject,
  cancelHackathonProjectSubmission,
} from "@/lib/actions/hackathon";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users, Swords, UserPlus, X, Check, Lock, Clock,
  LogOut, Github, Globe, ExternalLink, ChevronDown,
  Camera, ImageIcon, Loader2, MessageSquare,
  Pencil,
} from "lucide-react";
import type {
  Event, HackathonSettings, HackathonTeamWithMembers,
  HackathonTeamInvite, HackathonScore, EventPhoto,
  HackathonChatChannel, HackathonChatMessage, ChatMember, CompetitionJudgingResult,
  HackathonProfile, Mentor,
} from "@/types";
import { HackathonChat } from "@/components/hackathon-chat/HackathonChat";
import { MemberProfileModal } from "@/components/hackathon-chat/MemberProfileModal";
import { TeamFinderPanel } from "@/components/hackathon-chat/TeamFinderPanel";
import { JudgingWinnersPodium } from "@/components/hackathon-judging/JudgingWinnersReveal";
import { HackathonEffects } from "@/components/hackathon/HackathonEffects";
import { AudienceVoteCard } from "@/components/hackathon/AudienceVoteCard";
import { HackathonRulesButton } from "@/components/hackathon/HackathonRulesButton";
import { TeamIcon } from "@/components/hackathon/TeamIcon";
import { MentorCard } from "@/components/demos/MentorCard";
import { JudgeBadge } from "@/components/hackathon/JudgeBadge";
import type { PollWithVotes } from "@/types";
import {
  HACKATHON_SCORE_CATEGORIES,
  HACKATHON_SCORE_MAX,
  calculateAverageHackathonWeightedScore,
} from "@/lib/hackathon-rubric";

interface Props {
  event: Event;
  userId: string;
  isAdmin: boolean;
  settings: HackathonSettings | null;
  myTeam: HackathonTeamWithMembers | null;
  receivedInvites: HackathonTeamInvite[];
  sentInviteUserIds: string[];
  allTeams: HackathonTeamWithMembers[];
  openPool: {
    id: string;
    name: string;
    occupation: string | null;
    is_technical: boolean | null;
    unique_skill: string | null;
    linkedin_url: string | null;
    profile_bio: string | null;
    project_interests: string | null;
    collaboration_style: string | null;
    looking_for_teammates: string | null;
  }[];
  scores: HackathonScore[];
  publicAIScores?: PublicAIScore[];
  chatChannels: HackathonChatChannel[];
  initialMessages: HackathonChatMessage[];
  initialChannelId: string;
  chatMembers: ChatMember[];
  publishedJudgingResults: CompetitionJudgingResult[];
  needsTeam?: boolean;
  hackathonProfile: HackathonProfile | null;
  mentors: Mentor[];
  judges: Mentor[];
  mentorSlots: { id: string; mentor_id: string | null; is_full: boolean }[];
  myMentorSlotId: string | null;
  initialScreenshots?: { id: string; file_url: string }[];
  teamScreenshots?: Record<string, string>;
  initialTeamAnalyses?: { id: string; pass_name: string; status: string; updated_at: string }[];
  audienceVotePoll?: PollWithVotes | null;
}

type PublicAIScore = {
  team_id: string;
  overall_score: number;
  criteria_scores: { criteria_key: string; score: number }[];
  updated_at: string;
};

type Tab = "overview" | "my-team" | "all-teams" | "open-pool" | "people" | "chat";
type PeopleTab = "mentors" | "judges";

const HACKATHON_TABS = new Set<Tab>(["overview", "my-team", "all-teams", "open-pool", "people", "chat"]);
const DEFAULT_HACKATHON_PROMPT = "Sample prompt....xxx etc.";
const TEAM_ICON_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const TEAM_ICON_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PROJECT_JUDGING_LOCK_BUFFER_MS = 5 * 60 * 1000;

function isHackathonTab(value: string | null | undefined): value is Tab {
  return Boolean(value && HACKATHON_TABS.has(value as Tab));
}

function getTeamIconValidationError(file: File): string | null {
  if (!TEAM_ICON_ALLOWED_TYPES.includes(file.type)) {
    return "Only image files are supported (PNG, JPEG, WebP, GIF)";
  }

  if (file.size > TEAM_ICON_MAX_SIZE_BYTES) {
    return "File size exceeds 10MB limit";
  }

  return null;
}

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
  return calculateAverageHackathonWeightedScore(s);
}

function aiScorePoints(score: PublicAIScore | null | undefined): number | null {
  return score ? Math.round(score.overall_score * 10) : null;
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

function getProjectSubmissionCutoff(settings: HackathonSettings | null): Date | null {
  if (settings?.judging_starts_at) {
    return new Date(new Date(settings.judging_starts_at).getTime() - PROJECT_JUDGING_LOCK_BUFFER_MS);
  }
  return settings?.submission_deadline ? new Date(settings.submission_deadline) : null;
}

function isProjectSubmissionOpen(settings: HackathonSettings | null, now: Date | null): boolean {
  const cutoff = getProjectSubmissionCutoff(settings);
  return !cutoff || !now || now < cutoff;
}

export function HackathonClient({
  event, userId, isAdmin, settings, myTeam: initialMyTeam,
  receivedInvites: initialInvites, sentInviteUserIds: initialSent,
  allTeams: initialAllTeams, openPool: initialPool, scores, publicAIScores = [],
  chatChannels, initialMessages, initialChannelId, chatMembers,
  publishedJudgingResults, needsTeam = false, initialScreenshots = [], teamScreenshots = {}, initialTeamAnalyses = [],
  audienceVotePoll = null, hackathonProfile, mentors, judges, mentorSlots, myMentorSlotId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("mentors");
  const [now, setNow] = useState<Date>(() => new Date());
  const tabStorageKey = `hackathon:${event.id}:${userId}:tab`;

  // Local state (updated by realtime or optimistic)
  const [myTeam, setMyTeam] = useState(initialMyTeam);
  const [receivedInvites, setReceivedInvites] = useState(initialInvites);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set(initialSent));
  const [allTeams, setAllTeams] = useState(initialAllTeams);
  const [pool, setPool] = useState(initialPool);

  // Invite modal
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null);
  const [teamFinderProfileMember, setTeamFinderProfileMember] = useState<ChatMember | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  // Solo team (teams of 1)
  const [soloName, setSoloName] = useState("");
  const [showSoloForm, setShowSoloForm] = useState(false);
  const [inviteLogoFile, setInviteLogoFile] = useState<File | null>(null);
  const [inviteLogoPreviewUrl, setInviteLogoPreviewUrl] = useState<string | null>(null);
  const inviteLogoInputRef = useRef<HTMLInputElement>(null);

  // Project form
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState(myTeam?.project?.name ?? "");
  const [projectDesc, setProjectDesc] = useState(myTeam?.project?.description ?? "");
  const [projectRepo, setProjectRepo] = useState(myTeam?.project?.repo_url ?? "");
  const [projectDemo, setProjectDemo] = useState(myTeam?.project?.demo_url ?? "");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState(initialMyTeam?.name ?? "");
  const teamIconInputRef = useRef<HTMLInputElement>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Screenshots
  const [screenshots, setScreenshots] = useState<{ id: string; file_url: string }[]>(initialScreenshots);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inviteLogoFile) {
      setInviteLogoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(inviteLogoFile);
    setInviteLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [inviteLogoFile]);

  useEffect(() => {
    const hashTab = window.location.hash.replace(/^#/, "");
    const storedTab = window.localStorage.getItem(tabStorageKey);

    if (hashTab === "mentors" || hashTab === "judges") {
      setPeopleTab(hashTab);
      setTab("people");
      return;
    }

    if ((storedTab === "mentors" || storedTab === "judges") && !isHackathonTab(hashTab)) {
      setPeopleTab(storedTab);
      setTab("people");
      return;
    }

    const restoredTab = isHackathonTab(hashTab)
      ? hashTab
      : isHackathonTab(storedTab)
        ? storedTab
        : null;

    if (restoredTab) setTab(restoredTab);
  }, [tabStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(tabStorageKey, tab);
    const nextHash = tab === "overview" ? "" : `#${tab}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [tab, tabStorageKey]);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

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
  const aiScoresVisible = settings?.ai_scores_visible ?? false;
  const maxTeamSize = settings?.max_team_size ?? 4;
  const minTeamSize = settings?.min_team_size ?? 1;
  const teamSizeLabel = minTeamSize === maxTeamSize ? `${maxTeamSize}` : `${minTeamSize}–${maxTeamSize}`;
  const totalTeamMembers = allTeams.reduce((sum, team) => sum + team.members.length, 0);
  const submittedProjects = allTeams.filter((team) => team.project?.submitted_at).length;
  const totalParticipants = totalTeamMembers + pool.length;
  const eventHasStarted = !!event.start_time && new Date(event.start_time) <= now;
  const promptText = settings?.prompt_text?.trim() || DEFAULT_HACKATHON_PROMPT;
  const projectSubmitted = Boolean(myTeam?.project?.submitted_at);
  const projectSubmissionOpen = isProjectSubmissionOpen(settings, now);
  const projectSubmissionCutoff = getProjectSubmissionCutoff(settings);
  const projectSubmissionCutoffLabel = projectSubmissionCutoff
    ? formatEventDateTime(projectSubmissionCutoff.toISOString(), event.timezone)
    : null;
  const visiblePublicAIScores = useMemo(
    () => aiScoresVisible ? publicAIScores : [],
    [aiScoresVisible, publicAIScores]
  );
  const publicAIScoreByTeamId = useMemo(
    () => new Map(visiblePublicAIScores.map((score) => [score.team_id, score])),
    [visiblePublicAIScores]
  );
  const hasPublicAIScores = visiblePublicAIScores.length > 0;
  const myTeamPublicAIScore = myTeam ? publicAIScoreByTeamId.get(myTeam.id) ?? null : null;
  const openTeamSlots = formationOpen
    ? allTeams.reduce((sum, team) => sum + Math.max(0, maxTeamSize - team.members.length), 0)
    : 0;
  const rankedTeams = useMemo(() => {
    if (!leaderboardVisible) return [];

    return [...allTeams]
      .map((team) => {
        const hasManualScore = scores.some((score) => score.team_id === team.id);
        return { team, score: hasManualScore ? totalScore(team.id, scores) : null };
      })
      .filter((entry): entry is { team: HackathonTeamWithMembers; score: number } => entry.score != null)
      .sort((a, b) => b.score - a.score);
  }, [allTeams, leaderboardVisible, scores]);
  const aiRankedTeams = useMemo(() => (
    [...allTeams]
      .map((team) => ({ team, score: aiScorePoints(publicAIScoreByTeamId.get(team.id)) }))
      .filter((entry): entry is { team: HackathonTeamWithMembers; score: number } => entry.score != null)
      .sort((a, b) => b.score - a.score)
  ), [allTeams, publicAIScoreByTeamId]);
  const leadingLeaderboardTeam = rankedTeams[0]?.team ?? null;
  const leadingLeaderboardScore = rankedTeams[0]?.score ?? null;
  const leadingAITeam = aiRankedTeams[0]?.team ?? null;
  const leadingAIScore = aiRankedTeams[0]?.score ?? null;
  const leadingTeam = leadingLeaderboardTeam ?? leadingAITeam;
  const leadingTeamScore = leadingLeaderboardScore ?? leadingAIScore;
  const leadingSource = leadingLeaderboardTeam ? "leaderboard" : "AI screening";
  const showTeamScores = leaderboardVisible;
  const teamsForDisplay = useMemo(() => {
    if (!showTeamScores) {
      return allTeams.map((team) => ({ team, rank: null, score: null }));
    }

    const rankByTeamId = new Map(rankedTeams.map((entry, index) => [entry.team.id, index + 1]));
    const scoreByTeamId = new Map(rankedTeams.map((entry) => [entry.team.id, entry.score]));

    return [...allTeams]
      .sort((a, b) => (scoreByTeamId.get(b.id) ?? -1) - (scoreByTeamId.get(a.id) ?? -1))
      .map((team) => ({
        team,
        rank: rankByTeamId.get(team.id) ?? null,
        score: scoreByTeamId.get(team.id) ?? null,
      }));
  }, [allTeams, rankedTeams, showTeamScores]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!formationOpen && tab === "open-pool") {
      setTab("all-teams");
    }
  }, [formationOpen, tab]);

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
    if (!editingTeamName) {
      setTeamNameDraft(myTeam?.name ?? "");
    }
  }, [editingTeamName, myTeam?.name]);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // AI analysis status state for the attendee's own team.
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
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_ai_analyses", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_settings", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "event_photos", filter: `event_id=eq.${event.id}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "competition_judging_results", filter: `event_id=eq.${event.id}` }, refresh)
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

  const showMsg = (msg: string, isError = false, durationMs = 3000) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    messageTimeoutRef.current = setTimeout(() => {
      setError(null);
      setSuccess(null);
      messageTimeoutRef.current = null;
    }, durationMs);
  };

  const closeInviteModal = () => {
    setInviteTarget(null);
    setNewTeamName("");
    setInviteLogoFile(null);
  };

  const uploadTeamIconFile = async (file: File, teamId: string): Promise<{ photo?: EventPhoto; error?: string }> => {
    const validationError = getTeamIconValidationError(file);
    if (validationError) return { error: validationError };

    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventId", event.id);
    formData.append("teamId", teamId);

    try {
      const res = await fetch("/api/hackathon/team-icon", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Upload failed" };
      }

      return { photo: data.photo as EventPhoto };
    } catch {
      return { error: "Upload failed. Please try again." };
    }
  };

  const handleCreateSoloTeam = () => {
    const name = soloName.trim();
    if (!name) { showMsg("Team name is required", true); return; }
    startTransition(async () => {
      const res = await createSoloTeam(event.id, name);
      if (res.error) { showMsg(res.error, true); return; }
      setSoloName("");
      setShowSoloForm(false);
      setTab("all-teams");
      showMsg("Solo team created — you can submit your project now");
      refresh();
    });
  };

  const handleStartSolo = () => {
    startTransition(async () => {
      const res = await startSoloHackathonTeam(event.id);
      if (res.error) { showMsg(res.error, true); return; }
      setTab("all-teams");
      setShowProjectForm(true);
      showMsg("Solo project started — fill in your details and submit");
      refresh();
    });
  };

  const handleSendInvite = () => {
    if (!inviteTarget) return;
    startTransition(async () => {
      const targetName = inviteTarget.name;
      const res = await sendTeamInvite(
        event.id,
        inviteTarget.id,
        myTeam ? undefined : newTeamName.trim() || undefined
      );
      if (res.error) { showMsg(res.error, true); return; }

      let logoUploadError: string | null = null;
      if (inviteLogoFile && res.teamId) {
        setUploadingIcon(true);
        const uploadResult = await uploadTeamIconFile(inviteLogoFile, res.teamId);
        setUploadingIcon(false);

        if (uploadResult.error) {
          logoUploadError = uploadResult.error;
        } else if (uploadResult.photo && myTeam?.id === res.teamId) {
          const photo = uploadResult.photo;
          setMyTeam((prev) => prev ? { ...prev, icon_photo_id: photo.id, icon_photo: photo } : prev);
          setAllTeams((prev) => prev.map((team) =>
            team.id === res.teamId ? { ...team, icon_photo_id: photo.id, icon_photo: photo } : team
          ));
        }
      }

      setSentIds((prev) => new Set([...prev, inviteTarget.id]));
      closeInviteModal();
      showMsg(
        logoUploadError
          ? `Invite sent to ${targetName}, but the logo upload failed: ${logoUploadError}`
          : `Invite sent to ${targetName}`,
        Boolean(logoUploadError)
      );
      refresh();
    });
  };

  const handleCancelSentInvite = useCallback(async (invitedUserId: string, invitedName?: string) => {
    const res = await cancelTeamInvite(event.id, invitedUserId);
    if (res.error) {
      showMsg(res.error, true);
      return;
    }

    setSentIds((prev) => {
      const next = new Set(prev);
      next.delete(invitedUserId);
      return next;
    });
    showMsg(invitedName ? `Invite to ${invitedName} canceled` : "Invite canceled");
    refresh();
  }, [event.id, refresh]);

  const getProfileInviteStatus = (member: ChatMember): "hidden" | "available" | "sent" => {
    if (sentIds.has(member.id)) return "sent";
    if (!formationOpen || member.id === userId || member.team) return "hidden";
    return "available";
  };

  const openInviteModalFromProfile = (member: ChatMember) => {
    setTeamFinderProfileMember(null);
    setInviteTarget({ id: member.id, name: member.name });
  };

  const cancelInviteFromProfile = (member: ChatMember) => {
    setTeamFinderProfileMember(null);
    void handleCancelSentInvite(member.id, member.name);
  };

  const handleAccept = (inviteId: string) => {
    startTransition(async () => {
      const res = await acceptTeamInvite(inviteId);
      if (res.error) { showMsg(res.error, true); return; }
      setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setTab("all-teams");
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
      setTab(formationOpen ? "open-pool" : "all-teams");
      refresh();
    });
  };

  const handleDissolve = () => {
    if (!myTeam) return;
    if (!confirm(`Dissolve ${myTeam.name}? This removes the team and returns every member to the open pool.`)) return;
    startTransition(async () => {
      const res = await dissolveTeam(myTeam.id);
      if (res.error) { showMsg(res.error, true); return; }
      showMsg(`${res.dissolvedByName ?? "Someone"} dissolved ${res.teamName ?? myTeam.name}`, false, 10000);
      setMyTeam(null);
      setTab(formationOpen ? "open-pool" : "all-teams");
      refresh();
    });
  };

  const handleTeamRename = () => {
    if (!myTeam) return;
    const nextName = teamNameDraft.trim();
    if (!nextName) { showMsg("Team name is required", true); return; }
    if (nextName === myTeam.name) { setEditingTeamName(false); return; }

    const teamId = myTeam.id;
    startTransition(async () => {
      const res = await renameTeam(teamId, event.id, nextName);
      if (res.error) { showMsg(res.error, true); return; }

      const savedName = res.name ?? nextName;
      setMyTeam((prev) => prev ? { ...prev, name: savedName } : prev);
      setAllTeams((prev) => prev.map((team) =>
        team.id === teamId ? { ...team, name: savedName } : team
      ));
      setTeamNameDraft(savedName);
      setEditingTeamName(false);
      showMsg("Team name updated");
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
      showMsg(res.warning ?? "Project saved", false, res.fallback ? 10000 : 4000);
      setShowProjectForm(false);
      refresh();
    });
  };

  const handleProjectCancel = () => {
    if (!myTeam?.project?.submitted_at) return;
    if (!confirm("Cancel this project submission? You can edit it and resubmit until judging locks.")) return;
    startTransition(async () => {
      const res = await cancelHackathonProjectSubmission(myTeam.id, event.id);
      if (res.error) { showMsg(res.error, true); return; }
      setMyTeam((prev) => prev?.project
        ? { ...prev, project: { ...prev.project, submitted_at: null } }
        : prev
      );
      showMsg("Submission cancelled. Make your changes and resubmit before judging locks.", false, 6000);
      setShowProjectForm(true);
      refresh();
    });
  };

  const handleTeamIconUpload = async (file: File | undefined) => {
    if (!file || !myTeam) return;

    setUploadingIcon(true);
    try {
      const result = await uploadTeamIconFile(file, myTeam.id);
      if (result.error || !result.photo) {
        showMsg(result.error || "Upload failed", true);
        return;
      }

      const photo = result.photo;
      setMyTeam((prev) => prev ? { ...prev, icon_photo_id: photo.id, icon_photo: photo } : prev);
      setAllTeams((prev) => prev.map((team) =>
        team.id === myTeam.id ? { ...team, icon_photo_id: photo.id, icon_photo: photo } : team
      ));
      showMsg("Team icon submitted for approval");
      refresh();
    } finally {
      setUploadingIcon(false);
    }
  };

  const peopleCount = new Set([...mentors, ...judges].map((person) => person.id)).size;
  const tabs: { id: Tab; label: string; count?: number; icon?: React.ReactNode }[] = [
    { id: "overview", label: "Hub", icon: <Swords className="w-3.5 h-3.5" /> },
    { id: "all-teams", label: "Teams", count: allTeams.length },
    ...(formationOpen ? [{ id: "open-pool" as const, label: "Pool", count: pool.length }] : []),
    { id: "people", label: "People", count: peopleCount, icon: <UserPlus className="w-3.5 h-3.5" /> },
    { id: "chat", label: "Chat", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  ];
  const showTeamFinder = formationOpen && !myTeam && (tab === "all-teams" || tab === "open-pool" || tab === "chat");
  const liveMentors = mentors.filter(
    (mentor) => mentor.mentorship_mode === "in_person" || mentor.mentorship_mode === "hybrid"
  );
  const onlineMentors = mentors.filter((mentor) => mentor.mentorship_mode === "virtual");
  const mentorSlotMap = useMemo(() => {
    const map = new Map<string, typeof mentorSlots>();
    for (const slot of mentorSlots) {
      if (!slot.mentor_id) continue;
      const slots = map.get(slot.mentor_id) ?? [];
      slots.push(slot);
      map.set(slot.mentor_id, slots);
    }
    return map;
  }, [mentorSlots]);
  const getMentorAvailability = (mentorId: string) => {
    const slots = mentorSlotMap.get(mentorId) ?? [];
    return {
      availableSlots: slots.filter((slot) => !slot.is_full).length,
      isBooked: slots.some((slot) => slot.id === myMentorSlotId),
    };
  };
  const teamFinderAvailableUserIds = useMemo(() => pool.map((person) => person.id), [pool]);
  const teamFinder = showTeamFinder ? (
    <TeamFinderPanel
      eventId={event.id}
      userId={userId}
      myTeamId={null}
      members={chatMembers}
      availableUserIds={teamFinderAvailableUserIds}
      sentInviteUserIds={[...sentIds]}
      onOpenProfile={setTeamFinderProfileMember}
      onInviteSent={(invitedUserId) => setSentIds((prev) => new Set([...prev, invitedUserId]))}
      onCancelInvite={(invitedUserId) => handleCancelSentInvite(invitedUserId)}
    />
  ) : null;
  const teamFinderProfileModal = teamFinderProfileMember ? (
    <MemberProfileModal
      member={teamFinderProfileMember}
      onClose={() => setTeamFinderProfileMember(null)}
      onInvite={openInviteModalFromProfile}
      onCancelInvite={cancelInviteFromProfile}
      inviteStatus={getProfileInviteStatus(teamFinderProfileMember)}
    />
  ) : null;

  const header = (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/40 px-5 py-6 shadow-lg backdrop-blur-3xl sm:px-8 sm:py-8 group">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px] opacity-20" />
      
      {/* Glowing orbs removed for sleekness */}
      
      {/* Top highlight line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <img src="/cursor-logo.svg" alt="Cursor" className="w-8 h-8 relative z-10 drop-shadow-sm brightness-150" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white sm:text-5xl drop-shadow-lg">
              HACKATHON
            </h1>
            <p className="mt-1.5 truncate text-sm font-medium text-gray-400/70 sm:text-[15px] uppercase tracking-widest">
              {event.name}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 self-start rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-md sm:self-center">
          <HackathonRulesButton compact />
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
          eventId={event.id}
          userId={userId}
          scoresCount={scores.length} 
          projectSubmitted={!!myTeam?.project?.submitted_at} 
          eventStarted={eventHasStarted} 
          teamFormed={!!myTeam}
        />
        <div className="mb-5 max-w-5xl mx-auto">
          {header}
        </div>
        {/* Tab bar — stays above chat */}
        <div className="relative mx-auto mb-5 flex w-full max-w-fit flex-wrap justify-center gap-2 rounded-xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl shadow-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300",
                t.id === tab
                  ? "bg-white text-black"
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
        {teamFinder && (
          <div className="mx-auto mb-5 max-w-5xl">
            {teamFinder}
          </div>
        )}
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
          sentInviteUserIds={[...sentIds]}
          onInviteFromProfile={formationOpen ? openInviteModalFromProfile : undefined}
          onCancelInviteFromProfile={cancelInviteFromProfile}
        />
        {teamFinderProfileModal}
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
        eventId={event.id}
        userId={userId}
        scoresCount={scores.length} 
        projectSubmitted={!!myTeam?.project?.submitted_at} 
        eventStarted={eventHasStarted} 
        teamFormed={!!myTeam}
      />

      {/* Header */}
      {header}

      <JudgingWinnersPodium results={publishedJudgingResults} />

      {/* Audience vote — shown prominently when active */}
      {audienceVotePoll && (
        <AudienceVoteCard poll={audienceVotePoll} eventSlug={event.slug} />
      )}

      {/* Pending invite banners */}
      {receivedInvites.length > 0 && (
        <div className="space-y-3">
          {receivedInvites.map((invite) => {
            const teamName = invite.team?.name ?? "a team";
            const teamIcon = invite.team?.icon_photo;

            return (
              <div key={invite.id} className="relative overflow-hidden rounded-xl border border-white/30 bg-white/10 p-5 backdrop-blur-xl shadow-lg">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15)_0,transparent_100%)]" />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <TeamIcon
                      photo={teamIcon}
                      name={teamName}
                      className="h-10 w-10 rounded-xl border-white/15 bg-white/10 shadow-lg"
                      fallbackClassName="opacity-20"
                      sizes="40px"
                    />
                    <p className="text-[15px] font-medium leading-relaxed text-gray-400">
                      <span className="font-bold text-white">{invite.inviter?.name ?? "Someone"}</span>
                      {" invited you to join "}
                      <span className="font-bold text-white">"{teamName}"</span>
                    </p>
                  </div>
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
            );
          })}
        </div>
      )}

      {/* Feedback */}
      {error && <div className="glass rounded-xl p-3 border border-amber-400/30 text-amber-300 text-sm">{error}</div>}
      {success && <div className="glass rounded-xl p-3 border border-green-400/30 text-green-400 text-sm">{success}</div>}

      {/* Tab bar */}
      <div className="relative mx-auto flex w-full max-w-fit flex-wrap justify-center gap-2 rounded-xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl shadow-lg">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300",
              tab === t.id
                ? "bg-white text-black"
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

      {teamFinder}

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-4 animate-slide-up">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-8 shadow-lg backdrop-blur-2xl sm:p-10">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <div className="absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            
            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2.5 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  Hackathon Hub
                </div>
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-2">
                    {eventHasStarted ? "Event status" : "Event starts in"}
                  </p>
                  <h2 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 sm:text-7xl drop-shadow-md">
                    {formatCountdown(event.start_time, now)}
                  </h2>
                  <div className="mt-4 flex items-center gap-3 text-sm font-medium text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {event.start_time
                        ? `${eventHasStarted ? "Started" : "Starts"} ${formatEventDateTime(event.start_time, event.timezone)}`
                        : "Start time has not been set yet."}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-gray-400" />
                      {plural(totalParticipants, "participant")} active
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={cn(
                "relative overflow-hidden rounded-xl border px-6 py-5 shadow-lg sm:min-w-56 backdrop-blur-md",
                formationOpen
                  ? "border-white/20 bg-white/5"
                  : "border-amber-500/30 bg-amber-500/10"
              )}>
                <div className="relative">
                  <div className={cn(
                    "flex items-center gap-2.5 text-[13px] font-black uppercase tracking-[0.2em]",
                    formationOpen ? "text-white" : "text-amber-400"
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
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
                    <Users className="h-3.5 w-3.5" />
                    Teams of {teamSizeLabel}
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

          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 shadow-lg backdrop-blur-xl sm:p-8">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:24px_24px]" />
            <div className="relative space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">Prompt</p>
              <p className="whitespace-pre-wrap text-2xl italic leading-relaxed tracking-tight text-white/90 sm:text-3xl">
                {promptText}
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/50 p-6 sm:p-8 shadow-lg backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/10" />
            
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">Mission Objective</p>
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
                  onClick={() => setTab(myTeam || !formationOpen ? "all-teams" : "open-pool")}
                  className="group relative overflow-hidden rounded-2xl bg-white px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.15em] text-black transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative">{myTeam || !formationOpen ? "View Teams" : "Open Pool"}</span>
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

          {(leaderboardVisible || hasPublicAIScores) && (
            <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-lg">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
              
              <div className="relative flex items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)] overflow-hidden relative">
                  <div className="absolute inset-0 bg-yellow-500/10 animate-pulse" />
                  <img src="/cursor-logo.svg" alt="Cursor" className="w-7 h-7 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] brightness-200" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-500/80">
                    {leadingLeaderboardTeam ? "Public Leaderboard" : "AI Screening"}
                  </p>
                  <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-gray-300">
                    {leadingTeam && leadingTeamScore != null
                      ? <><span className="text-white font-bold">{leadingTeam.name}</span> is currently leading the {leadingSource} with <span className="text-yellow-400 font-bold">{leadingTeamScore}</span> points.</>
                      : leaderboardVisible ? "Leaderboard is visible once scores are available." : "AI screening scores appear once analysis completes."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTab("all-teams")}
                className="relative shrink-0 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-[12px] font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 hover:border-white/30 hover:scale-105"
              >
                View Teams
              </button>
            </div>
          )}
        </div>
      )}

      {/* Teams tab */}
      {(tab === "my-team" || tab === "all-teams") && (
        <div className="space-y-4 animate-slide-up">
          {!myTeam ? (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-lg">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
              
              <div className="relative space-y-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-xl">
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tight text-white">You&apos;re not on a team yet</p>
                  {formationOpen ? (
                    <div className="mt-2 space-y-4">
                      <p className="text-[15px] font-medium text-gray-400">
                        Go to <button onClick={() => setTab("open-pool")} className="text-white hover:text-gray-300 underline decoration-white/30 underline-offset-4 transition-colors">Open Pool</button> to find teammates — or go solo (teams of 1 are allowed).
                      </p>
                      {showSoloForm ? (
                        <div className="mx-auto flex max-w-sm flex-col gap-2 sm:flex-row">
                          <input
                            autoFocus
                            value={soloName}
                            onChange={(e) => setSoloName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCreateSoloTeam();
                              if (e.key === "Escape") { setShowSoloForm(false); setSoloName(""); }
                            }}
                            maxLength={60}
                            placeholder="Your team name..."
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] font-medium text-white placeholder-gray-600 transition-colors focus:border-white/30 focus:bg-white/10 focus:outline-none"
                          />
                          <button
                            disabled={isPending || !soloName.trim()}
                            onClick={handleCreateSoloTeam}
                            className="rounded-xl bg-white px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-black transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                          >
                            Create
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSoloForm(true)}
                          className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
                        >
                          Create a solo team
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-4">
                      <p className="flex items-center justify-center gap-2 text-[13px] font-bold uppercase tracking-wider text-amber-500">
                        <Lock className="h-4 w-4" /> Team formation is closed
                      </p>
                      <p className="text-[15px] font-medium text-gray-400">
                        You can still submit your own project on your own.
                      </p>
                      <button
                        disabled={isPending}
                        onClick={handleStartSolo}
                        className="rounded-xl bg-white px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-black transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                      >
                        Submit your own project
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-10 backdrop-blur-xl shadow-lg space-y-8">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
                
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-5 min-w-0">
                    <TeamIcon
                      photo={myTeam.icon_photo}
                      name={myTeam.name}
                      className="h-20 w-20 rounded-xl border-white/15 bg-white/5 shadow-lg group"
                      imageClassName="transition-transform duration-500 group-hover:scale-110"
                      fallbackClassName="opacity-20"
                      sizes="80px"
                    />
                    <div className="min-w-0 pt-1">
                      {editingTeamName ? (
                        <div className="space-y-3">
                          <input
                            autoFocus
                            value={teamNameDraft}
                            maxLength={60}
                            onChange={(e) => setTeamNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleTeamRename();
                              }
                              if (e.key === "Escape") {
                                setTeamNameDraft(myTeam.name);
                                setEditingTeamName(false);
                              }
                            }}
                            className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-2xl font-black tracking-tight text-white placeholder-gray-600 transition-colors focus:border-white/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50 sm:text-3xl"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={isPending || !teamNameDraft.trim() || teamNameDraft.trim() === myTeam.name}
                              onClick={handleTeamRename}
                              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-black transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                            >
                              <Check className="w-3.5 h-3.5" /> Save Name
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => {
                                setTeamNameDraft(myTeam.name);
                                setEditingTeamName(false);
                              }}
                              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-4xl font-black tracking-tight truncate text-white drop-shadow-md">{myTeam.name}</h2>
                          {!teamLocked && (
                            <button
                              disabled={isPending}
                              onClick={() => {
                                setTeamNameDraft(myTeam.name);
                                setEditingTeamName(true);
                              }}
                              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-40"
                            >
                              <Pencil className="w-3 h-3" /> Rename
                            </button>
                          )}
                        </div>
                      )}
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
                          myTeam.icon_photo.status === "pending" ? "text-amber-400" : "text-gray-400"
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
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-white/30 hover:bg-white/10 hover:text-gray-400"
                      >
                        <LogOut className="w-4 h-4" /> Leave
                      </button>
                    )}
                    {!teamLocked && (
                      <button
                        disabled={isPending}
                        onClick={handleDissolve}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-white/30 hover:bg-white/10 hover:text-gray-400"
                      >
                        <X className="w-4 h-4" /> Dissolve
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative space-y-3">
                  {myTeam.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-5 py-4 transition-colors hover:bg-white/[0.04]">
                      <span className="text-[16px] font-medium text-white">{m.user?.name ?? "Unknown"}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.2em] rounded-full px-3 py-1.5",
                        m.role === "leader"
                          ? "bg-white/20 text-gray-400 border border-white/30"
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
                    className="relative w-full flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.01] py-4 text-[14px] font-bold uppercase tracking-wider text-gray-400 transition-all hover:border-white/40 hover:bg-white/5 hover:text-gray-400"
                  >
                    <UserPlus className="w-5 h-5" />
                    Invite from Open Pool
                  </button>
                )}
              </div>

              {/* Project submission */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 sm:p-8 backdrop-blur-xl shadow-lg">
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
                        {projectSubmitted ? "Project Submitted" : "Submit Project"}
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
                    {projectSubmitted ? (
                      <div className="space-y-4 rounded-xl border border-green-500/20 bg-green-500/[0.05] p-5">
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-green-300">Submission Locked</p>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-gray-300">
                            Your team already has a submitted project. To make changes, cancel this submission first, edit the form, then resubmit.
                            {projectSubmissionCutoffLabel ? ` Changes lock at ${projectSubmissionCutoffLabel}.` : ""}
                          </p>
                        </div>
                        {projectSubmissionOpen ? (
                          <button
                            disabled={isPending}
                            onClick={handleProjectCancel}
                            className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-white/30 bg-white/10 px-4 py-3 text-[13px] font-bold uppercase tracking-wider text-gray-400 transition-all hover:bg-white/20 disabled:opacity-40"
                          >
                            <X className="h-4 w-4" /> Cancel Submission
                          </button>
                        ) : (
                          <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-200">
                            Judging is about to begin, so this submission can no longer be cancelled.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">Project Name *</label>
                      <input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="What are you building?"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-white/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">Description</label>
                      <textarea
                        value={projectDesc}
                        onChange={(e) => setProjectDesc(e.target.value)}
                        rows={3}
                        placeholder="Brief description of your project..."
                        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-white/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
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
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-white/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
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
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-white/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
                        />
                      </div>
                    </div>
                    {/* Screenshots */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> Screenshots <span className="text-gray-400/70 normal-case tracking-normal font-medium ml-2">({screenshots.length}/5) — used for AI judging</span>
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {screenshots.map((s) => (
                          <div key={s.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-white/5 group shadow-lg">
                            <img src={s.file_url} alt="screenshot" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <button
                              onClick={() => handleScreenshotDelete(s.id)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-white">
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
                            className="w-24 h-24 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 flex items-center justify-center transition-all disabled:opacity-40 group"
                          >
                            {uploadingScreenshot
                              ? <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
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

                    {!projectSubmissionOpen && (
                      <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-200">
                        Project submissions are locked for judging.
                      </p>
                    )}

                    <button
                      disabled={isPending || !projectName.trim() || !projectSubmissionOpen}
                      onClick={handleProjectSubmit}
                      className="relative w-full overflow-hidden rounded-xl bg-white py-4 text-[15px] font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="relative">{projectSubmissionOpen ? "Submit Project" : "Submissions Locked"}</span>
                    </button>
                      </>
                    )}
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
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-lg space-y-4">
                    <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`relative flex h-3 w-3 items-center justify-center`}>
                          {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>}
                          <span className={`relative inline-flex h-2 w-2 rounded-full ${running ? "bg-white" : allDone ? "bg-green-500" : hasError ? "bg-white" : "bg-gray-500"}`}></span>
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
                              isDone ? "bg-white" :
                              isRunning ? "bg-white/50 animate-pulse" :
                              isError ? "bg-white/60" :
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
                        : "Starting analysis…"}
                    </p>
                  </div>
                );
              })()}

              {myTeamPublicAIScore && (
                <PublicAIScoreCard aiScore={myTeamPublicAIScore} title="Your AI Screening Score" />
              )}

              {/* Leaderboard (if visible) */}
              {leaderboardVisible && (
                <ScoreCard teamId={myTeam.id} scores={scores} />
              )}
            </>
          )}

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-500">All Teams</p>
                <p className="mt-1 text-sm font-medium text-gray-400">Browse every team while keeping your team controls in one place.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {plural(allTeams.length, "team")}
              </span>
            </div>

          {allTeams.length === 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-lg">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 mb-4 shadow-xl">
                  <Swords className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xl font-bold tracking-tight text-white">No teams formed yet — be the first!</p>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {teamsForDisplay.map(({ team, rank, score }) => (
              <TeamCard
                key={team.id}
                team={team}
                rank={rank}
                score={score}
                aiScore={publicAIScoreByTeamId.get(team.id) ?? null}
                screenshotUrl={teamScreenshots[team.id] ?? null}
                formationOpen={formationOpen}
              />
            ))}
          </div>
          </div>
        </div>
      )}

      {/* Open Pool tab */}
      {formationOpen && tab === "open-pool" && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[12px] font-medium text-gray-400">
              Invite people here to build your team.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <Users className="h-3.5 w-3.5" />
              Teams of {teamSizeLabel}
            </span>
          </div>
          {pool.length === 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl shadow-lg">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
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
                <div key={person.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl transition-all hover:bg-white/[0.04] group">
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-400 shadow-inner group-hover:border-white/30 group-hover:text-gray-400 transition-colors">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[16px] font-bold text-white tracking-tight">{person.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {person.occupation ? (
                            <p className="text-[11px] text-gray-400 truncate">{person.occupation}</p>
                          ) : (
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Looking for team</p>
                          )}
                          {person.is_technical !== null && (
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                              person.is_technical
                                ? "text-blue-300 border-blue-400/30 bg-blue-400/10"
                                : "text-purple-300 border-purple-400/30 bg-purple-400/10"
                            )}>
                              {person.is_technical ? "Technical" : "Non-Technical"}
                            </span>
                          )}
                        </div>
                        {(person.unique_skill || person.profile_bio || person.project_interests) && (
                          <div className="mt-2 space-y-1">
                            {person.unique_skill && (
                              <p className="text-[11px] font-semibold text-gray-400/80">
                                Skill: {person.unique_skill}
                              </p>
                            )}
                            {person.profile_bio && (
                              <p className="line-clamp-2 text-[12px] leading-relaxed text-gray-400">
                                {person.profile_bio}
                              </p>
                            )}
                            {person.project_interests && (
                              <p className="line-clamp-1 text-[11px] font-medium text-gray-500">
                                Interested in: {person.project_interests}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {formationOpen && (
                      alreadyInvited ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleCancelSentInvite(person.id, person.name)}
                          className="group flex min-w-[112px] items-center justify-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-green-400 transition-all hover:border-white/40 hover:bg-white/15 hover:text-gray-400 disabled:opacity-50"
                          aria-label={`Cancel invite to ${person.name}`}
                        >
                          <span className="flex items-center gap-1.5 group-hover:hidden">
                            <Check className="w-3 h-3" /> Invited
                          </span>
                          <span className="hidden group-hover:inline">Cancel Invite</span>
                        </button>
                      ) : (
                        <button
                          disabled={isPending}
                          onClick={() => setInviteTarget(person)}
                          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-white/50 hover:bg-white/20 hover:text-gray-400"
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

      {/* People tab */}
      {tab === "people" && (
        <div className="space-y-8 animate-slide-up">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-lg">
            <div className="relative flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Hackathon</p>
                <h2 className="text-4xl font-light text-white tracking-tight">People</h2>
                <p className="text-sm text-gray-500">Get guidance from mentors and meet the judging panel.</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
                <Users className="h-3.5 w-3.5" />
                Teams of {teamSizeLabel}
              </span>
            </div>
          </div>

          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {([
              { id: "mentors", label: "Mentors", count: mentors.length },
              { id: "judges", label: "Judges", count: judges.length },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => setPeopleTab(item.id)}
                className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                  peopleTab === item.id
                    ? "bg-white text-black shadow-glow"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {item.label}
                <span className="ml-2 opacity-60">{item.count}</span>
              </button>
            ))}
          </div>

          {peopleTab === "mentors" && (
            <>
              {onlineMentors.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_14px_rgba(96,165,250,0.65)]" />
                    <p className="text-sm uppercase tracking-[0.28em] text-blue-100 font-semibold">Book Online</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {onlineMentors.map((mentor) => {
                      const availability = getMentorAvailability(mentor.id);
                      return (
                        <MentorCard
                          key={mentor.id}
                          mentor={mentor}
                          eventSlug={event.slug}
                          availableSlots={availability.availableSlots}
                          isBooked={availability.isBooked}
                          basePath="hackathon"
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {liveMentors.length > 0 && (
                <section className="space-y-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Live On Site</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {liveMentors.map((mentor) => {
                      const availability = getMentorAvailability(mentor.id);
                      return (
                        <MentorCard
                          key={mentor.id}
                          mentor={mentor}
                          eventSlug={event.slug}
                          availableSlots={availability.availableSlots}
                          isBooked={availability.isBooked}
                          basePath="hackathon"
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {mentors.length === 0 && (
                <div className="glass rounded-2xl p-8 border-white/10 text-center">
                  <p className="text-sm text-gray-500">Mentors will be announced soon.</p>
                </div>
              )}
            </>
          )}

          {peopleTab === "judges" && (
            judges.length > 0 ? (
              <section className="space-y-3">
                {judges.map((judge) => (
                  <JudgeBadge key={judge.id} judge={judge} />
                ))}
              </section>
            ) : (
              <div className="glass rounded-2xl p-8 border-white/10 text-center">
                <p className="text-sm text-gray-500">Judges will be announced soon.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Invite modal */}
      {inviteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={closeInviteModal} />
          <div className="relative overflow-hidden rounded-2xl border border-white/30 bg-black/80 p-8 w-full max-w-md space-y-6 z-10 shadow-lg backdrop-blur-xl">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
            
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
                    className="w-full rounded-[20px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-medium text-white placeholder-gray-600 transition-colors focus:border-white/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
                  />
                  <p className="text-[11px] font-medium text-gray-500 ml-1">You&apos;ll be set as team leader</p>
                </div>
              )}

              {myTeam && (
                <p className="mt-4 text-[15px] font-medium text-gray-300 bg-white/5 border border-white/10 rounded-2xl p-4">
                  Inviting to <span className="text-white font-bold">{myTeam.name}</span>
                </p>
              )}

              <div className="mt-6 space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ml-1">
                  Team Logo (optional)
                </label>
                <input
                  ref={inviteLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const validationError = getTeamIconValidationError(file);
                    if (validationError) {
                      showMsg(validationError, true);
                      e.target.value = "";
                      return;
                    }

                    setInviteLogoFile(file);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => inviteLogoInputRef.current?.click()}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                      {inviteLogoPreviewUrl || myTeam?.icon_photo?.file_url ? (
                        <img
                          src={inviteLogoPreviewUrl ?? myTeam?.icon_photo?.file_url ?? ""}
                          alt="Team logo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-white">
                        {inviteLogoFile ? inviteLogoFile.name : myTeam?.icon_photo ? "Use current team logo" : "Upload a logo"}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                        Shows next to your invite
                      </p>
                    </div>
                  </button>
                  {inviteLogoFile && (
                    <button
                      type="button"
                      onClick={() => setInviteLogoFile(null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 transition-all hover:bg-white/10 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  disabled={isPending || uploadingIcon || (!myTeam && !newTeamName.trim())}
                  onClick={handleSendInvite}
                  className="relative flex-1 overflow-hidden rounded-xl bg-white py-4 text-[14px] font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative">{uploadingIcon ? "Uploading..." : "Send Invite"}</span>
                </button>
                <button
                  onClick={closeInviteModal}
                  className="px-6 rounded-xl border border-white/10 bg-white/5 text-[14px] font-bold uppercase tracking-wider text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {teamFinderProfileModal}
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
      "relative overflow-hidden rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.04] group",
      muted && "opacity-60"
    )}>
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400/70">{label}</p>
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
      "relative overflow-hidden rounded-xl border p-5 backdrop-blur-md transition-all",
      active 
        ? "border-white/40 bg-white/[0.05]" 
        : "border-white/10 bg-black/40 hover:bg-white/[0.03]"
    )}>
      {active && (
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
      )}
      <div className="relative flex items-center gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border",
          active ? "border-white/50 bg-white/20 text-gray-400" : "border-white/10 bg-white/5 text-gray-400"
        )}>
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-[0.2em]",
            active ? "text-gray-400" : "text-gray-500"
          )}>{label}</p>
          <p className="mt-0.5 text-[14px] font-medium text-gray-200">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PublicAIScoreBreakdown({ aiScore, compact = false }: { aiScore: PublicAIScore; compact?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
          AI screening only · judge scores open in Final Round
        </p>
        <p className="shrink-0 text-[11px] font-black text-white">
          Cursor <span className="text-gray-400">AI Judge</span> {aiScore.overall_score.toFixed(1)}/10
        </p>
      </div>

      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {HACKATHON_SCORE_CATEGORIES.map((category) => {
          const criterion = aiScore.criteria_scores.find((score) => score.criteria_key === category.key);
          const value = criterion?.score ?? null;
          const pct = value == null ? 0 : (value / 10) * 100;

          return (
            <div key={category.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-gray-300">{category.label}</span>
                  <span className="text-[10px] font-bold text-gray-500">{category.weight}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white to-white"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="w-14 text-right text-[12px] font-black tabular-nums text-white">
                {value == null ? "—" : value.toFixed(1)}/10
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublicAIScoreCard({ aiScore, title }: { aiScore: PublicAIScore; title: string }) {
  const points = aiScorePoints(aiScore);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/40 p-6 backdrop-blur-xl shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">{title}</h3>
          <p className="mt-1 text-[10px] font-medium text-gray-500">Public AI screening result</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{points}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400/70">/ {HACKATHON_SCORE_MAX} pts</p>
        </div>
      </div>
      <div className="relative">
        <PublicAIScoreBreakdown aiScore={aiScore} />
      </div>
    </div>
  );
}

function TeamCard({ team, rank, score, aiScore, screenshotUrl, formationOpen }: {
  team: HackathonTeamWithMembers;
  rank: number | null;
  score: number | null;
  aiScore: PublicAIScore | null;
  screenshotUrl: string | null;
  formationOpen: boolean;
}) {
  const displayScore = score;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all hover:bg-white/[0.04] group",
      rank === 1 ? "border-yellow-500/30 bg-yellow-500/[0.02]" : "border-white/10 bg-black/40"
    )}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          {rank != null && (
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-black",
              rank === 1 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
              rank === 2 ? "bg-gray-400/10 text-gray-300 border border-gray-400/20" :
              rank === 3 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
              "bg-white/5 text-gray-500 border border-white/10"
            )}>
              {rank}
            </div>
          )}
          <TeamIcon
            photo={team.icon_photo}
            name={team.name}
            className="h-14 w-14 rounded-2xl border-white/10 bg-white/5 shadow-lg transition-colors group-hover:border-white/30"
            fallbackClassName="opacity-20"
            sizes="56px"
          />
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{team.name}</h3>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}
              {!formationOpen && <span className="ml-2 text-amber-500">· Locked</span>}
            </p>
          </div>
        </div>
        {displayScore != null && (
          <div className="shrink-0 text-right">
            <p className="text-3xl font-black tabular-nums tracking-tight text-white drop-shadow-md">{displayScore}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400/70">
              {score != null ? `/ ${HACKATHON_SCORE_MAX} pts` : "AI score"}
            </p>
          </div>
        )}
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {team.members.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-gray-300">
            {m.user?.name ?? "Unknown"}
            {m.role === "leader" && <span className="text-gray-400">★</span>}
          </span>
        ))}
      </div>

      {team.project?.submitted_at && (
        <div className="relative mt-5 space-y-3">
          {screenshotUrl && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <img
                src={screenshotUrl}
                alt={`${team.project.name ?? team.name} screenshot`}
                loading="lazy"
                className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[14px] font-medium text-gray-300 truncate">{team.project.name}</p>
            <div className="flex shrink-0 gap-2">
              {team.project.repo_url && (
                <a href={team.project.repo_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-400">
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
        </div>
      )}

      {aiScore && (
        <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <PublicAIScoreBreakdown aiScore={aiScore} compact />
        </div>
      )}
    </div>
  );
}

function ScoreCard({ teamId, scores }: { teamId: string; scores: HackathonScore[] }) {
  const teamScores = scores.filter((s) => s.team_id === teamId);
  if (!teamScores.length) return null;
  const avg = (key: typeof HACKATHON_SCORE_CATEGORIES[number]["key"]) => {
    const vals = teamScores.map((s) => s[key]).filter((v) => v != null) as number[];
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  const total = calculateAverageHackathonWeightedScore(teamScores);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/40 p-6 backdrop-blur-xl shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">Your Score</h3>
          <p className="text-[10px] text-gray-500 mt-1">{teamScores.length} judge{teamScores.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black tracking-tight text-white drop-shadow-md">{total}</span>
          <span className="text-sm font-bold text-gray-500">/{HACKATHON_SCORE_MAX}</span>
        </div>
      </div>
      <div className="relative space-y-4">
        {HACKATHON_SCORE_CATEGORIES.map((c) => {
          const v = avg(c.key);
          return (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-300">{c.shortLabel}</span>
              <div className="flex items-center gap-4">
                <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-white to-white rounded-full" style={{ width: `${((v ?? 0) / 10) * 100}%` }} />
                </div>
                <span className="text-[14px] font-bold tabular-nums text-white w-12 text-right">{v ?? "—"}/10</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
