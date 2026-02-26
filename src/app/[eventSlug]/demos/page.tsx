import { notFound, redirect } from "next/navigation";
import { EventHeader } from "@/components/layout/EventHeader";
import { EventNavWrapper } from "@/components/layout/EventNavWrapper";
import { DemoSignupPanel } from "@/components/demos/DemoSignupPanel";
import { getEventBySlug, getAnnouncements } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getDemoAvailability,
  getDemoSlotsWithCounts,
  getOrCreateDemoSettings,
  syncDemoSlotsForWindow,
} from "@/lib/demo/service";

interface DemoPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function DemosPage({ params }: DemoPageProps) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  const supabase = await createServiceClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("checked_in_at")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!registration?.checked_in_at) {
    redirect(`/${eventSlug}`);
  }

  const settings = await getOrCreateDemoSettings(event);
  await syncDemoSlotsForWindow(event.id, settings.opens_at, settings.closes_at);

  const [slots, announcements, mySignup] = await Promise.all([
    getDemoSlotsWithCounts(event.id),
    getAnnouncements(event.id),
    supabase
      .from("demo_slot_signups")
      .select("slot_id")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const availability = getDemoAvailability(settings);
  const latestAnnouncement = announcements[0] || null;

  return (
    <div className="min-h-screen bg-black-gradient flex flex-col pb-56 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[150px] pointer-events-none" />

      <EventHeader event={event} announcement={latestAnnouncement} userId={session.userId} />

      <main className="max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Live Demos</p>
          <h1 className="text-4xl font-light text-white tracking-tight">Book a Demo Spot</h1>
          <p className="text-sm text-gray-500">
            Choose one 5-minute slot. Each slot supports up to two attendees.
          </p>
        </div>

        <DemoSignupPanel
          eventSlug={eventSlug}
          timezone={event.timezone || "America/Edmonton"}
          availability={availability}
          speakerName={settings.speaker_name}
          slots={slots}
          mySlotId={mySignup.data?.slot_id || null}
        />
      </main>

      <EventNavWrapper eventSlug={eventSlug} event={event} userId={session.userId} />
    </div>
  );
}
