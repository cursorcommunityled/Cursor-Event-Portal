"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CheckInClient } from "@/app/staff/[eventSlug]/checkin/CheckInClient";
import { SeatingManagementClient } from "@/components/admin/SeatingManagementClient";
import { ImportRegistrationsClient } from "@/components/admin/ImportRegistrationsClient";
import { updateEventDetails } from "@/lib/actions/agenda";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [capacityInput, setCapacityInput] = useState(String(event.capacity ?? 65));
  const [capacitySaved, setCapacitySaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSaveCapacity = () => {
    const parsed = parseInt(capacityInput);
    if (!parsed || parsed < 1) return;
    startTransition(async () => {
      const result = await updateEventDetails(event.id, event.slug, { capacity: parsed });
      if (result.success) {
        setCapacitySaved(true);
        setTimeout(() => setCapacitySaved(false), 2000);
        router.refresh();
      }
    });
  };

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
            <>
              {/* Capacity editor */}
              <div className="glass rounded-[28px] p-6 border border-white/[0.04] mb-8 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-1">Venue Capacity</p>
                  <p className="text-[9px] text-gray-700">Max attendees for this event</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={capacityInput}
                    onChange={(e) => setCapacityInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveCapacity()}
                    className="w-24 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm text-center focus:outline-none focus:border-white/20 transition-all"
                  />
                  <button
                    onClick={handleSaveCapacity}
                    disabled={isPending}
                    className={cn(
                      "h-10 px-5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-1.5",
                      capacitySaved
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                    )}
                  >
                    {capacitySaved ? <><Check className="w-3 h-3" /> Saved</> : "Save"}
                  </button>
                </div>
              </div>
              <CheckInClient
                event={event}
                eventSlug={eventSlug}
                adminCode={adminCode}
                initialRegistrations={initialRegistrations}
                stats={stats}
                initialAgendaItems={initialAgendaItems}
              />
              <div className="mt-12 pt-12 border-t border-white/[0.06]">
                <div className="mb-6">
                  <h3 className="text-sm font-light text-white">Import Registrations</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">CSV Upload</p>
                </div>
                <ImportRegistrationsClient
                  eventId={event.id}
                  eventSlug={eventSlug}
                  adminCode={adminCode}
                  existingEmails={initialRegistrations
                    .map((r) => r.user?.email)
                    .filter((e): e is string => !!e)}
                />
              </div>
            </>
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
