"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Zap, X, AlertCircle, UserPlus, Linkedin, ChevronLeft, ChevronRight } from "lucide-react";
import { sendTeamInvite } from "@/lib/actions/hackathon";
import { getTeamRecommendations, type TeamRecommendation } from "@/lib/actions/hackathon-profiles";
import type { ChatMember } from "@/types";

const PAGE_SIZE = 3;

export function TeamFinderPanel({
  eventId, userId, myTeamId, members, availableUserIds, sentInviteUserIds = [], onOpenProfile, onInviteSent, onCancelInvite,
}: {
  eventId: string;
  userId: string;
  myTeamId: string | null;
  members: ChatMember[];
  availableUserIds: string[];
  sentInviteUserIds?: string[];
  onOpenProfile: (member: ChatMember) => void;
  onInviteSent?: (userId: string) => void;
  onCancelInvite?: (userId: string) => Promise<void> | void;
}) {
  const [recs, setRecs] = useState<TeamRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRecommendations, setHasMoreRecommendations] = useState(true);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [inviteStatus, setInviteStatus] = useState<Record<string, "idle" | "pending" | "sent" | "canceling" | "error">>({});
  const [teamNameInputs, setTeamNameInputs] = useState<Record<string, string>>({});
  const [showNameInput, setShowNameInput] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const dismissStorageKey = `hackathon-chat:${eventId}:${userId}:team-finder-dismissed`;
  const availableUserIdsRef = useRef(availableUserIds);
  const recsRef = useRef<TeamRecommendation[]>([]);
  const availableUserKey = useMemo(() => [...availableUserIds].sort().join("|"), [availableUserIds]);
  const sentInviteIds = useMemo(() => new Set(sentInviteUserIds), [sentInviteUserIds]);

  useEffect(() => {
    availableUserIdsRef.current = availableUserIds;
  }, [availableUserIds]);

  useEffect(() => {
    recsRef.current = recs;
  }, [recs]);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(dismissStorageKey) === "true");
    } catch {
      setDismissed(false);
    }
  }, [dismissStorageKey]);

  useEffect(() => {
    if (dismissed !== false) return;

    let cancelled = false;
    setLoading(true);
    getTeamRecommendations(eventId).then((res) => {
      if (cancelled) return;
      const available = new Set(availableUserIdsRef.current);
      setRecs(res.recommendations.filter((rec) => available.has(rec.userId)));
      setPageIndex(0);
      setHasMoreRecommendations(Boolean(res.hasMore));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dismissed, eventId]);

  useEffect(() => {
    if (dismissed !== false || loading) return;

    const available = new Set(availableUserIds);
    const filtered = recsRef.current.filter((rec) => available.has(rec.userId));
    const removedUnavailable = filtered.length !== recsRef.current.length;
    if (!removedUnavailable) return;

    setRecs(filtered);
    setPageIndex((page) => Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)));

    if (filtered.length >= PAGE_SIZE || !hasMoreRecommendations || availableUserIds.length <= filtered.length) {
      return;
    }

    let cancelled = false;
    setLoadingMore(true);
    getTeamRecommendations(eventId, filtered.map((rec) => rec.userId)).then((res) => {
      if (cancelled) return;
      const existingIds = new Set(filtered.map((rec) => rec.userId));
      const nextRecs = res.recommendations.filter(
        (rec) => available.has(rec.userId) && !existingIds.has(rec.userId)
      );
      setRecs([...filtered, ...nextRecs]);
      setHasMoreRecommendations(Boolean(res.hasMore) && nextRecs.length > 0);
      setLoadingMore(false);
    });

    return () => {
      cancelled = true;
      setLoadingMore(false);
    };
  }, [availableUserIds, availableUserKey, dismissed, eventId, hasMoreRecommendations, loading]);

  const pageCount = Math.max(1, Math.ceil(recs.length / PAGE_SIZE));
  const visibleRecs = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return recs.slice(start, start + PAGE_SIZE);
  }, [pageIndex, recs]);

  const canGoBack = pageIndex > 0;
  const canGoForward = pageIndex < pageCount - 1;
  const canLoadMore = hasMoreRecommendations && !loadingMore;

  const loadMoreRecommendations = async () => {
    if (!canLoadMore) return;

    setLoadingMore(true);
    const seenUserIds = recs.map((rec) => rec.userId);
    const res = await getTeamRecommendations(eventId, seenUserIds);
    const existingIds = new Set(seenUserIds);
    const nextRecs = res.recommendations.filter((rec) => !existingIds.has(rec.userId));

    if (nextRecs.length > 0) {
      setRecs((prev) => [...prev, ...nextRecs]);
      setPageIndex(Math.floor(recs.length / PAGE_SIZE));
    }

    setHasMoreRecommendations(Boolean(res.hasMore) && nextRecs.length > 0);
    setLoadingMore(false);
  };

  const handleNextPage = () => {
    if (canGoForward) {
      setPageIndex((page) => Math.min(pageCount - 1, page + 1));
      return;
    }

    loadMoreRecommendations();
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissStorageKey, "true");
    } catch {
      // Ignore storage failures; the in-memory dismissal still applies this session.
    }
  };

  const handleInvite = async (userId: string, nameOverride?: string) => {
    setInviteStatus((s) => ({ ...s, [userId]: "pending" }));
    const res = await sendTeamInvite(eventId, userId, nameOverride);
    if (res.error) {
      setInviteStatus((s) => ({ ...s, [userId]: "error" }));
      setTimeout(() => setInviteStatus((s) => ({ ...s, [userId]: "idle" })), 3000);
    } else {
      setInviteStatus((s) => ({ ...s, [userId]: "sent" }));
      setShowNameInput(null);
      onInviteSent?.(userId);
    }
  };

  const handleYes = (userId: string) => {
    if (myTeamId) {
      handleInvite(userId);
    } else {
      setShowNameInput(userId);
    }
  };

  const handleCancelInvite = async (userId: string) => {
    if (!onCancelInvite) return;
    setInviteStatus((s) => ({ ...s, [userId]: "canceling" }));
    await onCancelInvite(userId);
    setInviteStatus((s) => {
      const next = { ...s };
      delete next[userId];
      return next;
    });
  };

  if (dismissed !== false || (!loading && recs.length === 0)) return null;

  return (
    <div className="shrink-0 mx-3 mt-3 sm:mx-5">
      <div className="relative overflow-hidden rounded-[28px] border border-white/30 bg-white/[0.07] p-4 shadow-[0_0_40px_rgba(239,68,68,0.08)]">
        <div className="absolute inset-0 bg-grid-white/[0.01] bg-[size:15px_15px]" />
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-[50px]" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/20 border border-white/30">
                <Zap className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">Team Finder</span>
              <span className="text-[10px] text-gray-500 font-medium">— your top matches</span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-600 hover:text-gray-400 transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3" role="status" aria-live="polite">
              <div className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                <AlertCircle className="w-3.5 h-3.5" />
                suggestions loading!
              </div>
              <div className="flex gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex-1 h-20 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-stretch gap-2.5">
              <button
                type="button"
                onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
                disabled={!canGoBack}
                aria-label="Previous team matches"
                className="hidden w-9 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/30 text-gray-400 transition-all hover:border-white/30 hover:bg-white/10 hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-30 sm:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  {visibleRecs.map((rec) => {
                    const status = inviteStatus[rec.userId] ?? (sentInviteIds.has(rec.userId) ? "sent" : "idle");
                    const teamName = teamNameInputs[rec.userId] ?? "";
                    const profileMember = members.find((member) => member.id === rec.userId) ?? {
                      id: rec.userId,
                      name: rec.name,
                      role: "attendee" as ChatMember["role"],
                      team: null,
                      team_role: null,
                      occupation: rec.occupation,
                      is_technical: rec.is_technical,
                      unique_skill: rec.unique_skill,
                      linkedin_url: rec.linkedin_url,
                      needs_team: true,
                      profile_bio: rec.profile_bio,
                      project_interests: rec.project_interests,
                      collaboration_style: rec.collaboration_style,
                      looking_for_teammates: rec.looking_for_teammates,
                    };
                    return (
                      <div
                        key={rec.userId}
                        className="flex-1 rounded-2xl border border-white/[0.06] bg-black/30 p-3.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenProfile(profileMember)}
                            className="text-left text-[14px] font-bold text-white leading-tight hover:text-gray-400 hover:underline decoration-white/40 underline-offset-4 transition-colors"
                          >
                            {rec.name}
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {rec.is_technical !== null && (
                              <span className={`text-[8px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${
                                rec.is_technical
                                  ? "text-gray-400 bg-white/10 border-white/20"
                                  : "text-orange-400 bg-orange-500/10 border-orange-500/20"
                              }`}>
                                {rec.is_technical ? "Tech" : "Non-Tech"}
                              </span>
                            )}
                            {rec.linkedin_url && (
                              <a
                                href={rec.linkedin_url.startsWith("http") ? rec.linkedin_url : `https://${rec.linkedin_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-600 hover:text-gray-400 transition-colors"
                              >
                                <Linkedin className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.occupation && (
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-300">
                              {rec.occupation}
                            </span>
                          )}
                          {rec.is_technical !== null && (
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-300">
                              {rec.is_technical ? "Technical builder" : "Non-technical / product"}
                            </span>
                          )}
                          {rec.unique_skill && (
                            <span className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-gray-400">
                              {rec.unique_skill}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-gray-300 leading-snug">{rec.reason}</p>

                        {status === "sent" || status === "canceling" ? (
                          onCancelInvite ? (
                            <button
                              type="button"
                              disabled={status === "canceling"}
                              onClick={() => handleCancelInvite(rec.userId)}
                              className="group rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-green-300 transition-all hover:border-white/35 hover:bg-white/15 hover:text-gray-400 disabled:opacity-50"
                            >
                              <span className="group-hover:hidden">
                                {status === "canceling" ? "Canceling..." : "Invited"}
                              </span>
                              <span className="hidden group-hover:inline">Cancel Invite</span>
                            </button>
                          ) : (
                            <p className="text-[11px] font-bold text-green-400">Invited</p>
                          )
                        ) : status === "error" ? (
                          <p className="text-[11px] font-bold text-gray-400">Could not send invite</p>
                        ) : showNameInput === rec.userId && !myTeamId ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              value={teamName}
                              onChange={(e) => setTeamNameInputs((s) => ({ ...s, [rec.userId]: e.target.value }))}
                              placeholder="Team name…"
                              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-gray-600 focus:outline-none focus:border-white/50"
                            />
                            <button
                              disabled={!teamName.trim() || status === "pending"}
                              onClick={() => handleInvite(rec.userId, teamName.trim())}
                              className="px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-white/20 border border-white/30 text-gray-400 hover:bg-white/30 transition-all disabled:opacity-40"
                            >
                              Go
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={status === "pending"}
                            onClick={() => handleYes(rec.userId)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-white/15 border border-white/25 text-gray-400 hover:bg-white/25 hover:border-white/40 transition-all disabled:opacity-40"
                          >
                            <UserPlus className="w-3 h-3" />
                            {status === "pending" ? "Sending…" : "Invite"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(pageCount > 1 || hasMoreRecommendations || loadingMore) && (
                  <div className="flex items-center justify-between gap-3 sm:justify-center">
                    <button
                      type="button"
                      onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
                      disabled={!canGoBack}
                      className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 transition-all hover:border-white/30 hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-30 sm:hidden"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </button>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-600">
                      {loadingMore ? "Loading next matches..." : `${pageIndex + 1} / ${pageCount}${hasMoreRecommendations ? "+" : ""}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={!canGoForward && !canLoadMore}
                      className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 transition-all hover:border-white/30 hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-30 sm:hidden"
                    >
                      {loadingMore ? "Loading" : "Next"}
                      {!loadingMore && <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={!canGoForward && !canLoadMore}
                aria-label={canGoForward ? "Next team matches" : "Load more team matches"}
                className="hidden w-9 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/30 text-gray-400 transition-all hover:border-white/30 hover:bg-white/10 hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-30 sm:flex"
              >
                {loadingMore ? (
                  <span className="h-4 w-4 animate-pulse rounded-full bg-white/60" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}