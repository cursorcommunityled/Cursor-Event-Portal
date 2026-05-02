import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getEventBySlug, getEventStats } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { AttendeeCheckinForm } from "@/components/forms/AttendeeCheckinForm";
import { formatDate, formatTime } from "@/lib/utils";

interface EventPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventSlug } = await params;

  const event = await getEventBySlug(eventSlug);

  if (!event) {
    notFound();
  }

  // Check if already registered and checked in
  const session = await getSession();
  if (session && session.eventId === event.id) {
    // Check if checked in - if yes, go to the primary event surface
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();
    const { data: registration } = await supabase
      .from("registrations")
      .select("checked_in_at")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .single();
    
    if (registration?.checked_in_at) {
      redirect(event.is_hackathon ? `/${eventSlug}/hackathon` : `/${eventSlug}/agenda`);
    }
  }

  const stats = await getEventStats(event.id);

  return (
    <main className="min-h-screen bg-black-gradient flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Depth Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md z-10 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 floating">
          <div className="relative w-full max-w-[280px] mx-auto mb-6">
            <Image
              src="/cursor-calgary.avif"
              alt="Cursor Calgary"
              width={280}
              height={140}
              className="w-full h-auto rounded-2xl shadow-[0_0_60px_rgba(255,255,255,0.1)]"
              priority
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col items-center gap-1 text-gray-400 text-sm font-light tracking-wide">
              {event.start_time && (
                <p className="text-white/70">
                  {formatDate(event.start_time, event.timezone || "America/Edmonton")} · {formatTime(event.start_time, event.timezone || "America/Edmonton")}
                </p>
              )}
              {event.venue && (
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mt-2">
                  {event.venue}
                </p>
              )}
              {event.address && (
                <p className="text-[10px] text-gray-500 font-light">
                  {event.address}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area - Check-in Flow */}
        <div className="animate-slide-up">
          <AttendeeCheckinForm
            eventId={event.id}
            eventSlug={eventSlug}
            seatingEnabled={event.seating_enabled}
            isHackathon={event.is_hackathon}
          />
        </div>

        {/* Minimal Stats - Floating indicator */}
        {stats.registered > 0 && (
          <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">
                {stats.checkedIn} / {stats.registered} Present
              </span>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
