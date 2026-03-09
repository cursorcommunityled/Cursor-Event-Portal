"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Calendar, MessageCircle, FolderOpen, BarChart3, Lock, FileText, Menu, X, Trophy, MonitorPlay, Shuffle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSeenItemIds, markMultipleItemsAsSeen } from "@/lib/supabase/seenItems";
import { LiveSlidePopup } from "@/components/slides/LiveSlidePopup";
import { SlideDeckPopup } from "@/components/slides/SlideDeckPopup";
import { SurveyPopupAlert } from "@/components/survey/SurveyPopupAlert";
import type { Event, Survey } from "@/types";

interface EventNavProps {
  eventSlug: string;
  event?: Event;
  userId?: string; // Optional: if provided, uses Supabase for seen tracking
}

const navItems = [
  { href: "agenda", label: "Event", icon: Calendar },
  { href: "demos", label: "Demos", icon: MonitorPlay },
  { href: "networking", label: "Network", icon: Shuffle },
  { href: "socials", label: "Socials", icon: MessageCircle },
  { href: "slides", label: "Slides", icon: FileText },
  { href: "polls", label: "Polls", icon: BarChart3, hasAlert: true },
  { href: "competitions", label: "Compete", icon: Trophy },
  { href: "resources", label: "Resources", icon: FolderOpen },
];

export function EventNav({ eventSlug, event, userId }: EventNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasActivePolls, setHasActivePolls] = useState(false);
  const [pollAlertVisible, setPollAlertVisible] = useState(false);
  const [isLockoutActive, setIsLockoutActive] = useState(
    (event?.seat_lockout_active ?? false) && (event?.seating_enabled ?? true)
  );
  const [hasLiveSlideDeck, setHasLiveSlideDeck] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [seenPollIds, setSeenPollIds] = useState<Set<string>>(new Set());
  const [publishedSurvey, setPublishedSurvey] = useState<Survey | null>(null);
  const [helpWaitingCount, setHelpWaitingCount] = useState(0);

  // Load seen poll IDs from Supabase
  const loadSeenPollIds = useCallback(async () => {
    if (!userId || !event) return;
    
    try {
      const seenIds = await getSeenItemIds(userId, event.id, 'poll');
      setSeenPollIds(new Set(seenIds));
    } catch (error) {
      console.error("[EventNav] Error loading seen polls:", error);
    }
  }, [userId, event]);

  // Load seen IDs on mount
  useEffect(() => {
    if (userId && event) {
      loadSeenPollIds();
    }
  }, [userId, event, loadSeenPollIds]);

  // Subscribe to lockout status changes
  useEffect(() => {
    if (!event) return;
    
    const supabase = createClient();
    const channel = supabase
      .channel(`event-lockout-nav-${event.id}`)
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
          setIsLockoutActive(newEvent.seat_lockout_active && (newEvent.seating_enabled ?? true));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event]);

  // Check for live slide deck and subscribe to changes
  useEffect(() => {
    if (!event) return;

    const checkLiveSlideDeck = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("slide_decks")
        .select("id")
        .eq("event_id", event.id)
        .eq("is_live", true)
        .limit(1);

      setHasLiveSlideDeck((data?.length || 0) > 0);
    };

    checkLiveSlideDeck();

    const supabase = createClient();
    const channel = supabase
      .channel(`slide-decks-nav-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "slide_decks",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          checkLiveSlideDeck();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event]);

  // Mark polls as seen when visiting polls page
  useEffect(() => {
    if (pathname.includes("/polls") && userId && event) {
      const markPollsAsSeen = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("polls")
          .select("id")
          .eq("event_id", event.id)
          .eq("is_active", true);

        if (data && data.length > 0) {
          const pollIds = data.map((p) => p.id);
          
          // Use Supabase tracking
          await markMultipleItemsAsSeen(userId, event.id, 'poll', pollIds);
          
          setSeenPollIds(prev => {
            const updated = new Set(prev);
            pollIds.forEach(id => updated.add(id));
            return updated;
          });
          setPollAlertVisible(false);
        }
      };

      markPollsAsSeen().catch(err => console.error("[EventNav] Error marking polls as seen:", err));
    }
  }, [pathname, userId, event]);

  // Check for published survey
  useEffect(() => {
    if (!event) return;

    const checkPublishedSurvey = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("event_id", event.id)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[EventNav] Error fetching published survey:", error);
      }
      setPublishedSurvey(data || null);
    };

    checkPublishedSurvey();

    // Subscribe to survey changes
    const supabase = createClient();
    const channel = supabase
      .channel(`surveys-nav-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "surveys", filter: `event_id=eq.${event.id}` },
        () => {
          checkPublishedSurvey();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event]);

  // Check for active polls and subscribe to changes
  useEffect(() => {
    if (!event) return;

    const checkActivePolls = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("polls")
        .select("id")
        .eq("event_id", event.id)
        .eq("is_active", true);

      if (!data) {
        setHasActivePolls(false);
        setPollAlertVisible(false);
        return;
      }

      const hasPolls = data.length > 0;
      setHasActivePolls(hasPolls);

      // Only show alert if there are active polls that haven't been seen
      if (hasPolls && !pathname.includes("/polls")) {
        const unseenPolls = data.filter((p) => !seenPollIds.has(p.id));
        setPollAlertVisible(unseenPolls.length > 0);
      } else {
        setPollAlertVisible(false);
      }
    };

    checkActivePolls();

    // Subscribe to poll changes
    const supabase = createClient();
    const channel = supabase
      .channel(`polls-nav-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "polls", filter: `event_id=eq.${event.id}` },
        () => {
          checkActivePolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname, event, seenPollIds]);

  // Check for help requests and subscribe to changes
  useEffect(() => {
    if (!event) return;

    const supabase = createClient();

    const checkHelpWaiting = async () => {
      const { count, error } = await supabase
        .from("help_requests")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "waiting");

      if (error) {
        console.error("[EventNav] Error fetching help requests:", error);
        return;
      }
      setHelpWaitingCount(count || 0);
    };

    checkHelpWaiting();

    const channel = supabase
      .channel(`help-requests-nav-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests", filter: `event_id=eq.${event.id}` },
        () => {
          checkHelpWaiting();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event]);

  // Close mobile menu when navigating
  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  const renderNavItems = () => (
    navItems.map((item) => {
      const isActive = pathname.includes(`/${eventSlug}/${item.href}`);
      const Icon = item.icon;
      const showPollAlert =
        item.hasAlert && hasActivePolls && pollAlertVisible && !isActive;
      const showHelpCount = item.href === "socials" && helpWaitingCount > 0;

      // During lockout, only Agenda is accessible
      const isDisabled = isLockoutActive && item.href !== "agenda";
      // Slides tab is always visible but grayed out when deck isn't live
      const isSlideDeckNotLive = item.href === "slides" && !hasLiveSlideDeck;

      if (isDisabled) {
        return (
          <div
            key={item.href}
            className="flex flex-col items-center justify-center gap-1.5 py-4 w-full transition-all duration-300 relative group text-gray-800 cursor-not-allowed"
          >
            <div className="transition-all duration-300 relative opacity-40">
              <Icon className="w-5 h-5 stroke-[1.5px]" />
              <Lock className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-gray-600" />
            </div>
            <span
              className="text-[8px] font-bold uppercase tracking-[0.15em] transition-all duration-300 whitespace-nowrap mt-1 opacity-0 group-hover:opacity-40 translate-y-1 group-hover:translate-y-0"
            >
              {item.label}
            </span>
          </div>
        );
      }

      // If slide deck is not live, render as non-clickable div with tooltip
      if (isSlideDeckNotLive) {
        return (
          <div
            key={item.href}
            className="flex flex-col items-center justify-center gap-1.5 py-4 w-full transition-all duration-300 relative group text-gray-600 cursor-default"
          >
            <div className="transition-all duration-300 relative opacity-40">
              <Icon className="w-5 h-5 stroke-[1.5px]" />
            </div>
            <span
              className={cn(
                "text-[8px] font-bold uppercase tracking-[0.15em] transition-all duration-300 whitespace-nowrap mt-1 opacity-0 group-hover:opacity-40 translate-y-1 group-hover:translate-y-0"
              )}
            >
              {item.label}
            </span>
            {/* Tooltip on hover */}
            <div className="absolute left-full ml-3 px-2 py-1 bg-black/90 border border-white/10 rounded-lg text-[9px] text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              Available at Event Start
            </div>
          </div>
        );
      }

      return (
        <Link
          key={item.href}
          href={`/${eventSlug}/${item.href}`}
          onClick={handleNavClick}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-4 w-full transition-all duration-300 relative group",
            isActive
              ? "text-white"
              : "text-gray-600 hover:text-white"
          )}
        >
          <div className={cn(
            "transition-all duration-300 relative",
            isActive && "scale-110"
          )}>
            <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />

            {/* Poll alert indicator */}
            {showPollAlert && (
              <div className="absolute -top-1 -right-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-75" />
              </div>
            )}

            {/* Help request count */}
            {showHelpCount && (
              <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                {helpWaitingCount > 9 ? "9+" : helpWaitingCount}
              </div>
            )}
          </div>
          <span
            className={cn(
              "text-[8px] font-bold uppercase tracking-[0.15em] transition-all duration-300 whitespace-nowrap mt-1",
              isActive ? "opacity-100 translate-y-0" : "opacity-0 group-hover:opacity-60 translate-y-1 group-hover:translate-y-0"
            )}
          >
            {item.label}
          </span>

          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          )}
        </Link>
      );
    })
  );

  return (
    <>
      {/* Live Slide Popup - shows on right side when slides are live */}
      {event && <LiveSlidePopup eventId={event.id} eventSlug={eventSlug} />}
      {/* Slide Deck Popup - shows on right side when popup is enabled */}
      {event && <SlideDeckPopup eventId={event.id} eventSlug={eventSlug} />}
      {/* Survey Popup Alert - shows when survey popup is enabled */}
      {event && (
        <SurveyPopupAlert
          event={event}
          eventSlug={eventSlug}
          initialSurvey={publishedSurvey}
          userId={userId}
        />
      )}

      {/* Desktop Nav - hidden on mobile */}
      <nav className="hidden md:block fixed left-6 top-1/2 -translate-y-1/2 z-50 p-4 pointer-events-none">
        <div className="glass rounded-[40px] border border-white/5 w-20 pointer-events-auto shadow-[0_30px_60px_rgba(0,0,0,0.8)] transition-all duration-300 hover:w-24 hover:shadow-[0_30px_60px_rgba(0,0,0,0.9),0_0_20px_rgba(255,255,255,0.1)]">
          <div className="py-6">
            <div className="flex flex-col items-center gap-4">
              {renderNavItems()}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav - collapsible bubble in bottom left */}
      <div
        className="md:hidden"
        style={{ position: 'fixed', left: '1rem', bottom: '1rem', top: 'auto', zIndex: 50 }}
      >
          {/* Expanded menu */}
          <div
            className={cn(
              "glass rounded-[32px] border border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.8)] mb-3 transition-all duration-300 origin-bottom-left overflow-hidden",
              isMobileMenuOpen
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-75 pointer-events-none"
            )}
          >
            <div className="py-4 px-2 w-20">
              <div className="flex flex-col items-center gap-2">
                {renderNavItems()}
              </div>
            </div>
          </div>

          {/* Toggle bubble button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "glass w-14 h-14 rounded-full border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all duration-200 active:scale-95 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8),0_0_15px_rgba(255,255,255,0.1)]",
              isMobileMenuOpen ? "bg-white/10" : "bg-black/40"
            )}
          >
            <div className="relative">
              <Menu
                className={cn(
                  "w-6 h-6 text-white transition-all duration-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  isMobileMenuOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
                )}
              />
              <X
                className={cn(
                  "w-6 h-6 text-white transition-all duration-300",
                  isMobileMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
                )}
              />
            </div>

            {/* Poll alert on bubble when menu closed */}
            {!isMobileMenuOpen && pollAlertVisible && hasActivePolls && (
              <div className="absolute -top-1 -right-1">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75" />
              </div>
            )}
          </button>
      </div>
    </>
  );
}
