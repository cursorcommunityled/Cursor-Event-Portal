"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AgendaAdminClient } from "../../agenda/AgendaAdminClient";
import { VenueAdminTab } from "../../event-dashboard/VenueAdminTab";
import { ThemesAdminTab } from "../../event-dashboard/ThemesAdminTab";
import { CalendarAdminTab } from "../../event-dashboard/CalendarAdminTab";
import { DemosAdminClient } from "../../demos/DemosAdminClient";
import { SlideDeckAdminClient } from "../../slides/SlideDeckAdminClient";
import { CompetitionsAdminClient } from "@/components/admin/CompetitionsAdminClient";
import { CreditsAdminTab } from "../../event-dashboard/CreditsAdminTab";
import { cn } from "@/lib/utils";
import type { Event, AgendaItem, ConversationTheme, EventThemeSelection, PlannedEvent, EventCalendarCity, Venue, SlideDeck, CompetitionWithEntries, DemoSignupSettings, CursorCredit, Mentor } from "@/types";
import type { DemoSlotWithCounts } from "@/lib/demo/service";

type TabType = "agenda" | "venue" | "sessions" | "slides" | "competitions" | "themes" | "calendar" | "credits";

const CREDITS_TAB_PASSWORD = "CursorCredits2026";
const CREDITS_TAB_UNLOCKED_KEY = "cursor-popup:credits-tab-unlocked";

const TABS: Array<{ id: TabType; label: string; description: string }> = [
  { id: "agenda",       label: "Agenda",       description: "Event schedule" },
  { id: "venue",        label: "Venue",        description: "Venue & active event" },
  { id: "sessions",     label: "Sessions",     description: "Mentor booking" },
  { id: "slides",       label: "Slides",       description: "Presentation deck" },
  { id: "competitions", label: "Competitions", description: "Project showcase" },
  { id: "themes",       label: "Themes",       description: "Conversation themes" },
  { id: "calendar",     label: "Calendar",     description: "Event planning" },
  { id: "credits",      label: "Credits",      description: "Sponsor codes" },
];

function hasCreditsTabAccess() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(CREDITS_TAB_UNLOCKED_KEY) === "true";
}

function rememberCreditsTabAccess() {
  try {
    window.sessionStorage.setItem(CREDITS_TAB_UNLOCKED_KEY, "true");
  } catch {
    // If sessionStorage is unavailable, keep the unlock for this render only.
  }
}

interface EventDashboardClientProps {
  event: Event;
  eventSlug: string;
  adminCode: string;
  // Agenda
  initialAgendaItems: AgendaItem[];
  // Themes
  themes: ConversationTheme[];
  themeSelection: EventThemeSelection | null;
  // Calendar
  plannedEvents: PlannedEvent[];
  calendarCities: EventCalendarCity[];
  venues: Venue[];
  // Venue selector
  allEvents: Pick<Event, "id" | "name" | "slug" | "status" | "start_time" | "venue">[];
  activeSlug: string;
  // Sessions
  demoSettings: DemoSignupSettings | null;
  demoSlots: DemoSlotWithCounts[];
  mentors: Mentor[];
  // Slides
  initialDeck: SlideDeck | null;
  // Competitions
  initialCompetitions: CompetitionWithEntries[];
  // Credits
  cursorCredits: CursorCredit[];
  // Active tab from URL
  activeTab: TabType;
}

export function EventDashboardClient({
  event,
  eventSlug,
  adminCode,
  initialAgendaItems,
  themes,
  themeSelection,
  plannedEvents,
  calendarCities,
  venues,
  allEvents,
  activeSlug,
  demoSettings,
  demoSlots,
  mentors,
  initialDeck,
  initialCompetitions,
  cursorCredits,
  activeTab: initialTab,
}: EventDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab === "credits" ? "agenda" : initialTab);
  const [creditsUnlocked, setCreditsUnlocked] = useState(false);
  const promptedInitialCreditsTab = useRef(false);

  const updateUrlTab = useCallback((tab: TabType) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  const requestCreditsAccess = useCallback(() => {
    if (creditsUnlocked || hasCreditsTabAccess()) {
      setCreditsUnlocked(true);
      return true;
    }

    const password = window.prompt("Enter the password to access Credits:");
    if (password === CREDITS_TAB_PASSWORD) {
      rememberCreditsTabAccess();
      setCreditsUnlocked(true);
      return true;
    }

    if (password !== null) {
      window.alert("Incorrect Credits password.");
    }
    return false;
  }, [creditsUnlocked]);

  useEffect(() => {
    if (initialTab !== "credits") {
      setActiveTab(initialTab);
      return;
    }

    if (hasCreditsTabAccess()) {
      setCreditsUnlocked(true);
      setActiveTab("credits");
      return;
    }

    if (promptedInitialCreditsTab.current) return;
    promptedInitialCreditsTab.current = true;

    if (requestCreditsAccess()) {
      setActiveTab("credits");
      return;
    }

    setActiveTab("agenda");
    updateUrlTab("agenda");
  }, [initialTab, requestCreditsAccess, updateUrlTab]);

  const updateTab = (tab: TabType) => {
    if (tab === "credits" && !requestCreditsAccess()) return;

    setActiveTab(tab);
    updateUrlTab(tab);
  };

  const activeTabData = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        eventSlug={eventSlug}
        adminCode={adminCode}
        title={event.name}
        subtitle="Program"
        showBackArrow={true}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1">
        {/* Tab switcher */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => updateTab(tab.id)}
                  className={cn(
                    "px-7 py-2.5 rounded-full text-sm font-medium tracking-wide transition-all duration-200",
                    isActive
                      ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
                      : "text-gray-500 hover:text-white/70"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="animate-fade-in pb-20">
          <div className="mb-8">
            <h2 className="text-xl font-light text-white">{activeTabData.label}</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
              {activeTabData.description}
            </p>
          </div>

          {activeTab === "agenda" && (
            <AgendaAdminClient
              event={event}
              eventSlug={eventSlug}
              initialItems={initialAgendaItems}
            />
          )}
          {activeTab === "venue" && (
            <VenueAdminTab
              event={event}
              eventSlug={eventSlug}
              adminCode={adminCode}
              allEvents={allEvents}
              activeSlug={activeSlug}
            />
          )}
          {activeTab === "sessions" && demoSettings && (
            <DemosAdminClient
              event={event}
              adminCode={adminCode}
              settings={demoSettings}
              slots={demoSlots}
              mentors={mentors}
              embedded
            />
          )}
          {activeTab === "sessions" && !demoSettings && (
            <p className="text-gray-500 text-sm">Session settings not configured.</p>
          )}
          {activeTab === "slides" && (
            <SlideDeckAdminClient
              event={event}
              eventSlug={eventSlug}
              adminCode={adminCode}
              initialDeck={initialDeck}
              embedded
            />
          )}
          {activeTab === "competitions" && (
            <CompetitionsAdminClient
              eventId={event.id}
              eventSlug={eventSlug}
              adminCode={adminCode}
              initialCompetitions={initialCompetitions}
            />
          )}
          {activeTab === "themes" && (
            <ThemesAdminTab
              eventId={event.id}
              adminCode={adminCode}
              themes={themes}
              initialSelection={themeSelection}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarAdminTab initialEvents={plannedEvents} initialCities={calendarCities} initialVenues={venues} adminCode={adminCode} />
          )}
          {activeTab === "credits" && creditsUnlocked && (
            <CreditsAdminTab
              eventId={event.id}
              eventSlug={eventSlug}
              adminCode={adminCode}
              initialCredits={cursorCredits}
              creditAmount={20}
            />
          )}
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10 mt-auto">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">{activeTabData.label}</p>
      </footer>
    </div>
  );
}
