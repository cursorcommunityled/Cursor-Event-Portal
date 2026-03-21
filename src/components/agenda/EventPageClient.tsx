"use client";

import { useState } from "react";
import { AgendaList } from "@/components/agenda/AgendaList";
import { EventSeriesSection } from "@/components/agenda/EventSeriesSection";
import { EventSubNav } from "@/components/agenda/EventSubNav";
import { AttendeeThemesView } from "@/components/agenda/AttendeeThemesView";
import { AttendeeCreditsView } from "@/components/agenda/AttendeeCreditsView";
import { fetchMyCredits } from "@/lib/actions/cursor-credits";
import type { AgendaItem, Event, ConversationTheme, CursorCredit } from "@/types";

interface SeriesEvent {
  id: string;
  name: string;
  slug: string;
  start_time: string | null;
  venue: string | null;
  status: string;
  registration_count: number;
}

interface EventPageClientProps {
  event: Event;
  agendaItems: AgendaItem[];
  seriesEvents: SeriesEvent[];
  activeTheme: ConversationTheme | null;
  credits: CursorCredit[];
  userId: string;
}

export function EventPageClient({
  event,
  agendaItems,
  seriesEvents,
  activeTheme,
  credits: initialCredits,
  userId,
}: EventPageClientProps) {
  const [activeTab, setActiveTab] = useState<"schedule" | "themes" | "credits">("schedule");
  const [credits, setCredits] = useState<CursorCredit[]>(initialCredits);

  const handleTabChange = async (tab: "schedule" | "themes" | "credits") => {
    setActiveTab(tab);
    if (tab === "credits") {
      const fresh = await fetchMyCredits(event.id, userId);
      setCredits(fresh);
    }
  };

  const isEasterEvent = event.slug === "calgary-march-2026";

  return (
    <main className="max-w-[704px] mx-auto w-full px-6 py-12 space-y-8">
      {/* Page heading */}
      <div className="space-y-2 relative">
        <div className="flex items-center gap-3">
          <p
            className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium animate-slide-up"
            style={{ animationDelay: "100ms" }}
          >
            Tonight
          </p>
          {isEasterEvent && (
            <span
              className="animate-slide-up select-none pointer-events-none"
              style={{ animationDelay: "150ms", fontSize: 13, opacity: 0.35 }}
            >
              🥚
            </span>
          )}
        </div>
        <h1
          className="text-4xl font-light text-white tracking-tight animate-slide-up"
          style={{ animationDelay: "200ms" }}
        >
          Event
        </h1>
        {isEasterEvent && (
          <div
            className="absolute top-0 right-0 flex gap-2 select-none pointer-events-none animate-fade-in"
            style={{ animationDelay: "400ms", opacity: 0.2, fontSize: 13 }}
          >
            <span>🌸</span>
            <span>🥚</span>
            <span>🌸</span>
          </div>
        )}
      </div>

      {/* Sub-nav */}
      <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
        <EventSubNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Tab content */}
      <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
        {activeTab === "schedule" && (
          <div className="space-y-8">
            {event.series_id && seriesEvents.length > 0 && (
              <EventSeriesSection
                currentEventId={event.id}
                seriesEvents={seriesEvents}
              />
            )}
            <AgendaList
              items={agendaItems}
              eventId={event.id}
              eventTimezone={event.timezone || "America/Edmonton"}
              eventStartTime={event.start_time}
            />
          </div>
        )}

        {activeTab === "themes" && (
          <AttendeeThemesView activeTheme={activeTheme} />
        )}

        {activeTab === "credits" && (
          <AttendeeCreditsView credits={credits} userId={userId} eventSlug={event.slug} eventId={event.id} />
        )}
      </div>
    </main>
  );
}
