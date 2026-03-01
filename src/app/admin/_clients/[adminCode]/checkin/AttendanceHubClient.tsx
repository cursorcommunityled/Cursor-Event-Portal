"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CheckInClient } from "@/app/staff/[eventSlug]/checkin/CheckInClient";
import { SeatingManagementClient } from "@/components/admin/SeatingManagementClient";
import { cn } from "@/lib/utils";
import type { Event, Registration, AgendaItem, AttendeeIntake, SuggestedGroup, TableQRCode } from "@/types";

type TabType = "checkin" | "seating";

const TABS: Array<{ id: TabType; label: string; description: string }> = [
  { id: "checkin", label: "Check-In", description: "Manage attendance" },
  { id: "seating", label: "Seating",  description: "Table management" },
];

interface AttendanceHubClientProps {
  event: Event;
  eventSlug: string;
  adminCode: string;
  // Check-In
  initialRegistrations: Registration[];
  stats: { registered: number; checkedIn: number };
  initialAgendaItems: AgendaItem[];
  // Seating
  intakes: AttendeeIntake[];
  groups: SuggestedGroup[];
  qrCodes: TableQRCode[];
  // Active tab from URL
  activeTab: TabType;
}

export function AttendanceHubClient({
  event,
  eventSlug,
  adminCode,
  initialRegistrations,
  stats,
  initialAgendaItems,
  intakes,
  groups,
  qrCodes,
  activeTab: initialTab,
}: AttendanceHubClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

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
        subtitle="Attendance"
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

          {activeTab === "checkin" && (
            <CheckInClient
              event={event}
              eventSlug={eventSlug}
              adminCode={adminCode}
              initialRegistrations={initialRegistrations}
              stats={stats}
              initialAgendaItems={initialAgendaItems}
              embedded
            />
          )}
          {activeTab === "seating" && (
            <SeatingManagementClient
              event={event}
              eventSlug={eventSlug}
              adminCode={adminCode}
              intakes={intakes}
              groups={groups}
              qrCodes={qrCodes}
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
