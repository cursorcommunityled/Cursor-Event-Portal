"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CheckInClient } from "@/app/staff/[eventSlug]/checkin/CheckInClient";
import { SeatingManagementClient } from "@/components/admin/SeatingManagementClient";
import { ImportRegistrationsClient } from "@/components/admin/ImportRegistrationsClient";
import { LumaSyncCard } from "@/components/admin/LumaSyncCard";
import { updateEventDetails } from "@/lib/actions/agenda";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { RegularsList } from "@/app/admin/_clients/[adminCode]/regulars/RegularsClient";
import type { Event, Registration, AgendaItem, AttendeeIntake, SuggestedGroup, TableQRCode } from "@/types";
import type { TopCheckedInGuest } from "@/lib/supabase/queries";

type TabType = "checkin" | "seating" | "regulars";

const TABS: Array<{ id: TabType; label: string; description: string }> = [
  { id: "checkin", label: "Check-In", description: "Manage attendance" },
  { id: "seating", label: "Seating",  description: "Table management" },
  { id: "regulars", label: "Regulars", description: "Top 10 checked-in guests" },
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
  topGuests: TopCheckedInGuest[];
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
  topGuests,
  activeTab: initialTab,
}: AttendanceHubClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [openRegularId, setOpenRegularId] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState(String(event.capacity ?? 65));
  const [capacitySaved, setCapacitySaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSaveCapacity = () => {
    const parsed = parseInt(capacityInput);
    if (!parsed || parsed < 1) return;
    startTransition(async () => {
      const result = await updateEventDetails(
        event.id,
        event.slug,
        { capacity: parsed },
        adminCode ?? event.admin_code
      );
      if ("success" in result && result.success) {
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
            <h2 className="text-xl font-light text-white">
              {activeTab === "regulars" ? "Most events attended" : activeTabData.label}
            </h2>
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
              <div className="glass rounded-[40px] p-8 md:p-10 border-white/20 mb-8">
                <div className="mb-8">
                  <h3 className="text-[11px] uppercase tracking-[0.4em] text-gray-400 font-medium">Most events attended</h3>
                  <p className="text-2xl font-light tracking-tight text-white/90 mt-2">
                    Top 10 checked-in guests
                  </p>
                </div>
                {topGuests.length > 0 ? (
                  <ol className="space-y-3">
                    {topGuests.map((guest, index) => (
                      <li key={guest.userId} className="flex items-baseline gap-4">
                        <span className="w-6 text-[11px] tabular-nums text-gray-600">{index + 1}</span>
                        <span className="text-base font-light tracking-tight text-white/90">
                          {guest.name} ({guest.eventCount})
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-500">No checked-in guests yet</p>
                )}
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
                  <h3 className="text-sm font-light text-white">Luma Sync</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
                    Auto Check-In &amp; Credits
                  </p>
                </div>
                <LumaSyncCard
                  eventId={event.id}
                  adminCode={adminCode}
                  initialLumaEventId={event.luma_event_id ?? null}
                />
              </div>
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
          {activeTab === "regulars" && (
            <RegularsList
              guests={topGuests}
              openUserId={openRegularId}
              onToggle={(userId) => setOpenRegularId((current) => (current === userId ? null : userId))}
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
