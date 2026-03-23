"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Event, Announcement } from "@/types";
import { cn } from "@/lib/utils";
import { EventTimer } from "@/components/timer/EventTimer";
import { createClient } from "@/lib/supabase/client";
import { hasUserSeenItem, markItemAsSeen } from "@/lib/supabase/seenItems";
import { MapPin } from "lucide-react";
import { DemoStatusBadge } from "@/components/demos/DemoStatusBadge";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface EventHeaderProps {
  event: Event;
  announcement?: Announcement | null;
  showTimer?: boolean;
  userId?: string;
}

interface TableAssignment {
  id: string;
  tableNumber: number;
}

export function EventHeader({ event, announcement: initialAnnouncement, showTimer = true, userId }: EventHeaderProps) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(initialAnnouncement || null);
  const [tableAssignment, setTableAssignment] = useState<TableAssignment | null>(null);
  const [isFirstView, setIsFirstView] = useState(false);
  const hasMarkedAsSeen = useRef(false);
  const [venueHovered, setVenueHovered] = useState(false);
  const venueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [egg1Found, setEgg1Found] = useState(false);

  // Listen for egg_1 being claimed by anyone
  useEffect(() => {
    if (event.slug !== "calgary-march-2026") return;
    const handler = (e: globalThis.Event) => {
      if ((e as CustomEvent).detail?.eggId === "egg_1") setEgg1Found(true);
    };
    window.addEventListener("egg-globally-claimed", handler);
    return () => window.removeEventListener("egg-globally-claimed", handler);
  }, [event.slug]);

  const handleVenueEnter = () => {
    if (venueTimeoutRef.current) clearTimeout(venueTimeoutRef.current);
    setVenueHovered(true);
  };
  const handleVenueLeave = () => {
    venueTimeoutRef.current = setTimeout(() => setVenueHovered(false), 200);
  };

  // Subscribe to real-time announcement updates
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel(`announcements-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
          filter: `event_id=eq.${event.id}`,
        },
        async (payload) => {
          // Fetch the new announcement
          const { data: newAnnouncement } = await supabase
            .from("announcements")
            .select("*")
            .eq("id", payload.new.id)
            .single();
          
          if (newAnnouncement) {
            setAnnouncement(newAnnouncement);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "announcements",
          filter: `event_id=eq.${event.id}`,
        },
        async (payload) => {
          // Fetch the updated announcement
          const { data: updatedAnnouncement } = await supabase
            .from("announcements")
            .select("*")
            .eq("id", payload.new.id)
            .single();
          
          if (updatedAnnouncement) {
            setAnnouncement(updatedAnnouncement);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "announcements",
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          // Hide announcement when deleted
          if (announcement?.id === payload.old.id) {
            setAnnouncement(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, announcement?.id]);

  // Auto-hide announcement when it expires
  useEffect(() => {
    if (!announcement || !announcement.expires_at) {
      return;
    }

    const expiresAt = new Date(announcement.expires_at).getTime();
    const now = Date.now();

    // If already expired, hide immediately
    if (now >= expiresAt) {
      setAnnouncement(null);
      return;
    }

    // Calculate time until expiration
    const timeUntilExpiry = expiresAt - now;

    // Set a timer to hide the announcement when it expires
    const timeoutId = setTimeout(() => {
      setAnnouncement(null);
    }, timeUntilExpiry);

    // Also set up a periodic check (every second) to catch any clock drift
    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      if (currentTime >= expiresAt) {
        setAnnouncement(null);
        clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [announcement]);

  // Fetch table assignment if userId is provided
  useEffect(() => {
    if (!userId) return;

    async function fetchTableAssignment() {
      try {
        const response = await fetch(`/api/table-assignment?eventId=${event.id}`);
        if (!response.ok) return;
        const data = await response.json();

        const qrAssignment = data.qrAssignment || null;
        const smartAssignment = data.smartAssignment || null;
        const newAssignment = qrAssignment
          ? { id: qrAssignment.id, tableNumber: qrAssignment.tableNumber }
          : smartAssignment
            ? { id: smartAssignment.groupId, tableNumber: smartAssignment.tableNumber }
            : null;
        setTableAssignment(newAssignment);

        if (newAssignment) {
          // Check if this is the first time seeing this assignment (using Supabase)
          try {
            const hasSeen = await hasUserSeenItem(userId!, "table_assignment", newAssignment.id);

            if (!hasSeen && !hasMarkedAsSeen.current) {
              setIsFirstView(true);
              hasMarkedAsSeen.current = true;

              // Mark as seen after the animation completes (15 seconds)
              setTimeout(async () => {
                try {
                  await markItemAsSeen(userId!, event.id, "table_assignment", newAssignment.id);
                } catch (err) {
                  console.error("[EventHeader] Error marking as seen:", err);
                }
                setIsFirstView(false);
              }, 15000);
            }
          } catch (err) {
            console.error("[EventHeader] Error checking seen status:", err);
          }
        }
      } catch (err) {
        console.error("[EventHeader] Table assignment fetch error:", err);
      }
    }

    fetchTableAssignment();

    const interval = setInterval(fetchTableAssignment, 10000);
    return () => clearInterval(interval);
  }, [event.id, userId]);

  const eventStartTime = event.start_time || "2026-01-29T00:00:00Z";
  const redThreshold = 180; // 3 hours from start

  return (
    <>
    <DemoStatusBadge
      eventId={event.id}
      eventSlug={event.slug}
      timezone={event.timezone || "America/Edmonton"}
    />
    <header className="sticky top-0 z-40">
      {showTimer && <EventTimer startTime={eventStartTime} redThreshold={redThreshold} />}
      {/* Announcement Banner */}
      {announcement && (
        <div className="bg-white text-black px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-center font-bold animate-fade-in">
          {announcement.content}
        </div>
      )}

      {/* Main Header */}
      <div className="glass border-b border-white/5 py-8 backdrop-blur-3xl">
        <div className="max-w-lg mx-auto px-6 flex items-center justify-between">
          <Link href={`/${event.slug}`} className="flex items-center gap-5 group">
            <div className="w-[86px] h-[86px] rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl group-hover:scale-105 transition-all flex items-center justify-center p-1">
              <div className="w-full h-full rounded-[14px] overflow-hidden">
                <Image
                  src="/cursor-calgary.avif"
                  alt="Cursor Calgary"
                  width={86}
                  height={86}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-white text-xl leading-tight tracking-tight">
                {event.name}
              </span>
              {event.venue ? (
                <div
                  className="relative"
                  onMouseEnter={handleVenueEnter}
                  onMouseLeave={handleVenueLeave}
                  onTouchStart={() => setVenueHovered(v => !v)}
                >
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold leading-tight cursor-pointer hover:text-gray-300 transition-colors flex items-center gap-1.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {event.venue}
                  </span>

                  {/* Venue Popup */}
                  <div
                    className={cn(
                      "absolute top-full left-0 mt-3 w-72 rounded-[20px] overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl bg-black/90 transition-all duration-300 origin-top-left z-50",
                      venueHovered
                        ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                    )}
                    onMouseEnter={handleVenueEnter}
                    onMouseLeave={handleVenueLeave}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {event.venue_image_url && (
                      <div
                        className="w-full h-36 overflow-hidden relative group/venue-img"
                        title={event.slug === "calgary-march-2026" ? "👀" : undefined}
                      >
                        <img
                          src={event.venue_image_url}
                          alt={event.venue}
                          className="w-full h-full object-cover group-hover/venue-img:scale-105 transition-transform duration-500"
                        />
                        {/* Full-coverage clickable layer for egg trigger */}
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (event.slug === "calgary-march-2026") {
                              window.dispatchEvent(
                                new CustomEvent("egg-found", {
                                  detail: { eggId: "egg_1" },
                                })
                              );
                            }
                          }}
                          onTouchStart={(e) => e.stopPropagation()}
                        />
                        {egg1Found && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-white/20 backdrop-blur-sm pointer-events-none">
                            <svg viewBox="0 0 100 130" width="12" height="16">
                              <path d="M50 5 C22 5 5 40 5 68 C5 103 22 128 50 128 C78 128 95 103 95 68 C95 40 78 5 50 5Z" fill="#1a1a1a" stroke="rgba(255,255,255,0.5)" strokeWidth="4" />
                            </svg>
                            <span className="text-[9px] text-white/70 uppercase tracking-[0.15em] font-medium">Egg Found Here</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-5 space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">
                        Venue
                      </p>
                      <p className="text-white text-sm font-medium tracking-tight">
                        {event.venue}
                      </p>
                      {event.address && (
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          {event.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-bold leading-tight">
                  Event Platform
                </span>
              )}
            </div>
          </Link>

          {/* Right-side badges */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            {userId && (
              <NotificationBell
                userId={userId}
                eventId={event.id}
                eventSlug={event.slug}
              />
            )}

            {tableAssignment && (
              <div className={cn(
                "flex items-center gap-3 px-5 py-2.5 rounded-2xl border shadow-xl backdrop-blur-xl group hover:bg-white/[0.05] transition-all duration-500",
                isFirstView
                  ? "bg-white/[0.15] border-white/60 shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-105"
                  : "bg-white/[0.03] border-white/10"
              )}>
                <MapPin className={cn(
                  "w-4 h-4 transition-colors duration-500",
                  isFirstView
                    ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                    : "text-gray-400 group-hover:text-white"
                )} />
                <div className="flex flex-col items-center text-center">
                  <span className={cn(
                    "text-[10px] uppercase tracking-[0.2em] font-bold transition-colors duration-500",
                    isFirstView ? "text-white/90" : "text-gray-500"
                  )}>Table</span>
                  <span className={cn(
                    "text-sm font-semibold transition-all duration-500",
                    isFirstView
                      ? "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-110"
                      : "text-white"
                  )}>
                    {tableAssignment.tableNumber}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
