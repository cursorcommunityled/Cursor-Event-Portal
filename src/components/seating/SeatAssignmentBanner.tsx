"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasUserSeenItem, markItemAsSeen } from "@/lib/supabase/seenItems";
import type { Event } from "@/types";
import { MapPin, Sparkles } from "lucide-react";

interface SeatAssignmentBannerProps {
  event: Event;
  userId: string;
}

interface SmartTableAssignment {
  tableNumber: number;
  groupName: string;
  groupId: string;
}

export function SeatAssignmentBanner({ event, userId }: SeatAssignmentBannerProps) {
  const [qrAssignment, setQrAssignment] = useState<{ id: string; tableNumber: number } | null>(null);
  const [smartAssignment, setSmartAssignment] = useState<SmartTableAssignment | null>(null);
  const [isSmartActive, setIsSmartActive] = useState(event.smart_seating_active);
  const [loading, setLoading] = useState(true);
  const [isQrFirstView, setIsQrFirstView] = useState(false);
  const [isSmartFirstView, setIsSmartFirstView] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const hasMarkedQrAsSeen = useRef(false);
  const hasMarkedSmartAsSeen = useRef(false);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSmartActiveRef = useRef(event.smart_seating_active);

  // Auto-dismiss entire banner after 30 seconds; reset when assignment changes
  useEffect(() => {
    const assignmentId = qrAssignment?.id ?? smartAssignment?.groupId ?? null;
    if (!assignmentId || loading) return;

    setBannerDismissed(false);
    if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    dismissTimeoutRef.current = setTimeout(() => setBannerDismissed(true), 30 * 1000);
    return () => {
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    };
  }, [loading, qrAssignment?.id, smartAssignment?.groupId]);

  useEffect(() => {
    isSmartActiveRef.current = isSmartActive;
  }, [isSmartActive]);

  useEffect(() => {
    let mounted = true;
    let pendingRefresh: ReturnType<typeof setTimeout> | null = null;

    async function fetchAssignment() {
      try {
        const response = await fetch(`/api/table-assignment?eventId=${event.id}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!mounted) return;

        const newQrAssignment = data.qrAssignment || null;
        const newSmartAssignment = data.smartAssignment || null;

        setQrAssignment(newQrAssignment);
        setSmartAssignment(newSmartAssignment);

        if (newQrAssignment) {
          try {
            const hasSeen = await hasUserSeenItem(userId, "table_assignment", newQrAssignment.id);
            
            if (!hasSeen && !hasMarkedQrAsSeen.current) {
              setIsQrFirstView(true);
              hasMarkedQrAsSeen.current = true;

              setTimeout(async () => {
                try {
                  await markItemAsSeen(userId, event.id, "table_assignment", newQrAssignment.id);
                } catch (err) {
                  console.error("[SeatAssignmentBanner] Error marking QR as seen:", err);
                }
                setIsQrFirstView(false);
              }, 15000);
            }
          } catch (err) {
            console.error("[SeatAssignmentBanner] Error checking QR seen status:", err);
          }
        }

        if (newSmartAssignment && isSmartActiveRef.current) {
          try {
            const hasSeen = await hasUserSeenItem(userId, "table_assignment", newSmartAssignment.groupId);
            
            if (!hasSeen && !hasMarkedSmartAsSeen.current) {
              setIsSmartFirstView(true);
              hasMarkedSmartAsSeen.current = true;

              setTimeout(async () => {
                try {
                  await markItemAsSeen(userId, event.id, "table_assignment", newSmartAssignment.groupId);
                } catch (err) {
                  console.error("[SeatAssignmentBanner] Error marking smart assignment as seen:", err);
                }
                setIsSmartFirstView(false);
              }, 15000);
            }
          } catch (err) {
            console.error("[SeatAssignmentBanner] Error checking smart seen status:", err);
          }
        }
      } catch (err) {
        console.error("[SeatAssignmentBanner] Table assignment fetch error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    function scheduleFetchAssignment() {
      if (pendingRefresh) return;
      pendingRefresh = setTimeout(() => {
        pendingRefresh = null;
        void fetchAssignment();
      }, 500);
    }

    fetchAssignment();

    // Subscribe to event changes for lockout status
    const supabase = createClient();
    const eventChannel = supabase
      .channel(`event-lockout-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${event.id}`,
        },
        (payload) => {
          const newEvent = payload.new as Event;
          const nextSmartActive = newEvent.smart_seating_active;
          isSmartActiveRef.current = nextSmartActive;
          setIsSmartActive(nextSmartActive);
          scheduleFetchAssignment();
        }
      )
      .subscribe();

    // Subscribe to group changes
    const groupChannel = supabase
      .channel(`group-assignment-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suggested_groups",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          scheduleFetchAssignment();
        }
      )
      .subscribe();

    const membershipChannel = supabase
      .channel(`group-membership-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suggested_group_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          scheduleFetchAssignment();
        }
      )
      .subscribe();

    // Subscribe to QR table registrations
    const qrChannel = supabase
      .channel(`qr-registration-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_registrations",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          scheduleFetchAssignment();
        }
      )
      .subscribe();

    const fallbackInterval = setInterval(fetchAssignment, 60_000);

    return () => {
      mounted = false;
      if (pendingRefresh) clearTimeout(pendingRefresh);
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(groupChannel);
      supabase.removeChannel(membershipChannel);
      supabase.removeChannel(qrChannel);
      clearInterval(fallbackInterval);
    };
  }, [event.id, userId]);

  const shouldShowQr = !!qrAssignment;
  const shouldShowSmart =
    !!smartAssignment &&
    isSmartActive &&
    smartAssignment.tableNumber !== qrAssignment?.tableNumber;

  if ((!shouldShowQr && !shouldShowSmart) || loading) {
    return null;
  }
  if (bannerDismissed) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 text-white shadow-lg relative overflow-hidden space-y-2">
      {shouldShowQr && (
        <div
          className={`relative overflow-hidden transition-all duration-1000 ${
            isQrFirstView
              ? "bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-b border-white/10"
              : "bg-zinc-900 border-b border-white/10"
          }`}
        >
          {isQrFirstView && (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            </>
          )}

          <div className="max-w-4xl mx-auto px-4 py-4 relative z-10">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center border-2 transition-all duration-500 ${
                    isQrFirstView
                      ? "bg-white/10 border-white/30 scale-105"
                      : "bg-white/10 border-white/20"
                  }`}
                >
                  <span className={`text-xl font-bold tabular-nums transition-all duration-500 ${isQrFirstView ? "scale-110" : ""}`}>
                    {qrAssignment?.tableNumber}
                  </span>
                </div>
                <div className="text-left">
                  <p className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-colors duration-500 ${
                    isQrFirstView ? "text-white/90" : "text-white/70"
                  }`}>
                    {isQrFirstView ? "Table Registered" : "Your Table"}
                  </p>
                  <p className={`text-lg font-medium tracking-tight transition-all duration-500 ${
                    isQrFirstView ? "text-white" : ""
                  }`}>
                    Table {qrAssignment?.tableNumber}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-10 bg-white/30" />

              <div className="hidden sm:flex items-center gap-2">
                <MapPin className={`w-4 h-4 transition-colors duration-500 ${isQrFirstView ? "text-sky-300" : "text-white/70"}`} />
                <span className="text-sm text-sky-200/95 font-medium drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-400/20">
                  Scanned seating
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {shouldShowSmart && (
        <div
          className={`relative overflow-hidden transition-all duration-1000 ${
            isSmartFirstView
              ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"
              : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600"
          }`}
        >
          {isSmartFirstView && (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(255,255,255,0.3)] animate-pulse" />
              <div className="absolute inset-0 bg-radial-glow opacity-50 animate-pulse" style={{ animationDuration: "2s" }} />
            </>
          )}

          <div className="max-w-4xl mx-auto px-4 py-4 relative z-10">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center border-2 transition-all duration-500 ${
                    isSmartFirstView
                      ? "bg-white/30 border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-110"
                      : "bg-white/20 border-white/40"
                  }`}
                >
                  <span className={`text-xl font-bold tabular-nums transition-all duration-500 ${isSmartFirstView ? "scale-110" : ""}`}>
                    {smartAssignment?.tableNumber}
                  </span>
                </div>
                <div className="text-left">
                  <p className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-colors duration-500 ${
                    isSmartFirstView ? "text-white/90" : "text-white/70"
                  }`}>
                    {isSmartFirstView ? "New Table Assigned" : "Move To"}
                  </p>
                  <p className={`text-lg font-medium tracking-tight transition-all duration-500 ${
                    isSmartFirstView ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" : ""
                  }`}>
                    Table {smartAssignment?.tableNumber}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-10 bg-white/30" />

              <div className="hidden sm:flex items-center gap-2">
                <MapPin className={`w-4 h-4 transition-colors duration-500 ${isSmartFirstView ? "text-white" : "text-white/70"}`} />
                <span className="text-sm text-white/90">{smartAssignment?.groupName}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to check if lockout is active (for disabling nav items)
export function useSeatLockout(event: Event) {
  const [isLockoutActive, setIsLockoutActive] = useState(event.seat_lockout_active);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-lockout-check-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${event.id}`,
        },
        (payload) => {
          const newEvent = payload.new as Event;
          setIsLockoutActive(newEvent.seat_lockout_active);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  return isLockoutActive;
}
