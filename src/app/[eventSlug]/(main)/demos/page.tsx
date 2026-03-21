import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { DemoSignupPanel } from "@/components/demos/DemoSignupPanel";
import { getEventBySlug } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getDemoAvailability,
  getDemoSlotsWithCounts,
  getOrCreateDemoSettings,
  syncDemoSlotsForWindow,
} from "@/lib/demo/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  let settings;
  try {
    settings = await getOrCreateDemoSettings(event);
    await syncDemoSlotsForWindow(event.id, settings.opens_at, settings.closes_at);
  } catch {
    redirect(`/${eventSlug}`);
  }

  if (!settings.is_enabled) {
    redirect(`/${eventSlug}/agenda`);
  }

  const [slots, mySignup] = await Promise.all([
    getDemoSlotsWithCounts(event.id),
    supabase
      .from("demo_slot_signups")
      .select("slot_id")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const availability = getDemoAvailability(settings, event.timezone || "America/Edmonton");

  return (
    <main className="max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Live Demos</p>
          <h1 className="text-4xl font-light text-white tracking-tight">Book a Demo Spot</h1>
          <p className="text-sm text-gray-500">
            Choose one 5-minute slot. Each slot supports up to two attendees.
          </p>
        </div>
        <div className="relative w-full sm:w-64 sm:flex-shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02]">
          <Image
            src="/Adventure.png"
            alt="Live demos and immersive experiences"
            width={256}
            height={160}
            className="w-full h-auto object-cover"
            priority
          />
        </div>
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
  );
}
