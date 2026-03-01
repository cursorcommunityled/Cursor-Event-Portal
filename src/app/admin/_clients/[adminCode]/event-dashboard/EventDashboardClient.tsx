"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Calendar, Sparkles, Clock } from "lucide-react";
import { AgendaAdminClient } from "../../agenda/AgendaAdminClient";
import { ThemesAdminTab } from "../../event-dashboard/ThemesAdminTab";
import { CalendarAdminTab } from "../../event-dashboard/CalendarAdminTab";
import { cn } from "@/lib/utils";
import type { Event, AgendaItem, ConversationTheme, EventThemeSelection, PlannedEvent } from "@/types";

type TabType = "agenda" | "themes" | "calendar";

const TABS: Array<{ id: TabType; label: string; icon: typeof Calendar; description: string }> = [
  { id: "agenda",   label: "Agenda",   icon: Clock,     description: "Event schedule" },
  { id: "themes",   label: "Themes",   icon: Sparkles,  description: "Conversation themes" },
  { id: "calendar", label: "Calendar", icon: Calendar,  description: "Event planning" },
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
  const Icon = activeTabData.icon;

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        eventSlug={eventSlug}
        adminCode={adminCode}
        subtitle="Event Dashboard"
        showBackArrow={true}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1">
        {/* Tab switcher */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => updateTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300",
                  isActive
                    ? "bg-white text-black shadow-glow scale-105"
                    : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
                )}
              >
                <TabIcon className={cn("w-4 h-4", isActive ? "text-black" : "text-gray-600")} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab header */}
        <div className="animate-fade-in pb-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h2 className="text-xl font-light text-white">{activeTabData.label}</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">
                {activeTabData.description}
              </p>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === "agenda" && (
            <AgendaAdminClient
              event={event}
              eventSlug={eventSlug}
              adminCode={adminCode}
              initialItems={initialAgendaItems}
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
            <CalendarAdminTab initialEvents={plannedEvents} />
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
