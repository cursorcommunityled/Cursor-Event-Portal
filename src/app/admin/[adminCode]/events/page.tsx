import { getAllEvents, getActiveEventSlug } from "@/lib/supabase/queries";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ActiveVenueSelector } from "@/components/admin/ActiveVenueSelector";
import { getEventForAdmin } from "@/lib/utils/admin";
import { CalendarDays, CheckCircle2, Clock, Circle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const revalidate = 0;

interface AdminEventsPageProps {
  params: Promise<{ adminCode: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: "Active",    color: "text-green-400" },
  published: { label: "Published", color: "text-blue-400" },
  draft:     { label: "Draft",     color: "text-gray-500" },
  completed: { label: "Completed", color: "text-gray-600" },
  archived:  { label: "Archived",  color: "text-gray-700" },
};

export default async function AdminEventsPage({ params }: AdminEventsPageProps) {
  const { adminCode } = await params;
  const event = await getEventForAdmin(adminCode);

  const [allEvents, activeSlug] = await Promise.all([
    getAllEvents(),
    getActiveEventSlug(),
  ]);

  return (
    <div className="min-h-screen bg-black-gradient text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <AdminHeader
        eventSlug={event.slug}
        adminCode={adminCode}
        subtitle="Events"
        showBackArrow={true}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 w-full z-10 flex-1 space-y-8">

        {/* Active venue selector */}
        <ActiveVenueSelector events={allEvents} activeSlug={activeSlug} />

        {/* Event list */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-medium">
            All Events
          </p>
          {allEvents.map((ev) => {
            const isActive = ev.slug === activeSlug;
            const cfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={ev.id}
                className={`glass rounded-2xl p-5 border transition-all ${
                  isActive
                    ? "border-white/30 bg-white/5"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-white/90 text-sm">{ev.venue || ev.name}</h4>
                        {isActive && (
                          <span className="text-[9px] uppercase tracking-widest text-green-400/80 font-medium">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">{ev.slug}</p>
                      {ev.start_time && (
                        <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(ev.start_time, "America/Edmonton")}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-medium shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-white/[0.03] flex justify-between items-center z-10 mt-auto">
        <p className="text-[10px] uppercase tracking-[0.6em] text-gray-500 font-medium">Pop-Up System / MMXXVI</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium">Events</p>
      </footer>
    </div>
  );
}
