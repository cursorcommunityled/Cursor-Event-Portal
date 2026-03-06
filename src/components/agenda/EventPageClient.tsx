"use client";

import { useState } from "react";
import { AgendaList } from "@/components/agenda/AgendaList";
import { EventSeriesSection } from "@/components/agenda/EventSeriesSection";
import { EventSubNav } from "@/components/agenda/EventSubNav";
import { AttendeeThemesView } from "@/components/agenda/AttendeeThemesView";
import { AttendeeCreditsView } from "@/components/agenda/AttendeeCreditsView";
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
  credit: CursorCredit | null;
  userId: string;
}

export function EventPageClient({
  event,
  agendaItems,
  seriesEvents,
  activeTheme,
  credit,
  userId,
}: EventPageClientProps) {
  const [activeTab, setActiveTab] = useState<"schedule" | "themes" | "credits">("schedule");

  return (
    <main className="max-w-[704px] mx-auto w-full px-6 py-12 space-y-8">
      {/* Page heading */}
      <div className="space-y-2">
        <p
          className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium animate-slide-up"
          style={{ animationDelay: "100ms" }}
        >
          Tonight
        </p>
        <h1
          className="text-4xl font-light text-white tracking-tight animate-slide-up"
          style={{ animationDelay: "200ms" }}
        >
          Event
        </h1>
      </div>

      {/* Sub-nav */}
      <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
        <EventSubNav activeTab={activeTab} onTabChange={setActiveTab} />
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
          <AttendeeCreditsView credit={credit} userId={userId} />
        )}
      </div>
    </main>
  );
}
