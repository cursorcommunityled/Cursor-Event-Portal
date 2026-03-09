"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ActiveVenueSelector } from "@/components/admin/ActiveVenueSelector";
import { AgendaAdminClient } from "../../agenda/AgendaAdminClient";
import { ThemesAdminTab } from "../../event-dashboard/ThemesAdminTab";
import { CalendarAdminTab } from "../../event-dashboard/CalendarAdminTab";
import { DemosAdminClient } from "../../demos/DemosAdminClient";
import { SlideDeckAdminClient } from "../../slides/SlideDeckAdminClient";
import { CompetitionsAdminClient } from "@/components/admin/CompetitionsAdminClient";
import { CreditsAdminTab } from "../../event-dashboard/CreditsAdminTab";
import { PostEventTab } from "../../event-dashboard/PostEventTab";
import { cn } from "@/lib/utils";
import type { Event, AgendaItem, ConversationTheme, EventThemeSelection, PlannedEvent, EventCalendarCity, Venue, SlideDeck, CompetitionWithEntries, DemoSignupSettings, CursorCredit } from "@/types";
import type { DemoSlotWithCounts } from "@/lib/demo/service";

type TabType = "agenda" | "demos" | "slides" | "competitions" | "themes" | "calendar" | "credits" | "post-event";

const TABS: Array<{ id: TabType; label: string; description: string }> = [
  { id: "agenda",       label: "Agenda",       description: "Event schedule" },
  { id: "demos",        label: "Demos",        description: "Signup management" },
  { id: "slides",       label: "Slides",       description: "Presentation deck" },
  { id: "competitions", label: "Competitions", description: "Project showcase" },
  { id: "themes",       label: "Themes",       description: "Conversation themes" },
  { id: "calendar",     label: "Calendar",     description: "Event planning" },
  { id: "credits",      label: "Credits",      description: "Sponsor codes" },
  { id: "post-event",   label: "Post-Event",   description: "Followup emails" },
];

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
  // Demos
  demoSettings: DemoSignupSettings | null;
  demoSlots: DemoSlotWithCounts[];
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
  initialDeck,
  initialCompetitions,
  cursorCredits,
  activeTab: initialTab,
}: EventDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const updateTab = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  const activeTabData = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        eventSlug={eventSlug}
        adminCode={adminCode}
        subtitle="Program"
        showBackArrow={true}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1">
        {/* Venue selector */}
        <div className="mb-10">
          <ActiveVenueSelector events={allEvents} activeSlug={activeSlug} />
        </div>

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
              adminCode={adminCode}
              initialItems={initialAgendaItems}
              venues={venues}
            />
          )}
          {activeTab === "demos" && demoSettings && (
            <DemosAdminClient
              event={event}
              adminCode={adminCode}
              settings={demoSettings}
              slots={demoSlots}
              embedded
            />
          )}
          {activeTab === "demos" && !demoSettings && (
            <p className="text-gray-500 text-sm">Demo settings not configured.</p>
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
            <CalendarAdminTab initialEvents={plannedEvents} initialCities={calendarCities} initialVenues={venues} />
          )}
          {activeTab === "credits" && (
            <CreditsAdminTab
              eventId={event.id}
              adminCode={adminCode}
              initialCredits={cursorCredits}
            />
          )}
          {activeTab === "post-event" && (
            <PostEventTab
              eventId={event.id}
              adminCode={adminCode}
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
