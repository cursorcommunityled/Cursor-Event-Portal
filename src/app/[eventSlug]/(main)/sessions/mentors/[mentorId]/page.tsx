import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEventBySlug, getMentors } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getDemoAvailability,
  getDemoSlotsWithCounts,
  getOrCreateDemoSettings,
} from "@/lib/demo/service";
import { SESSIONS_PAGE_ENABLED } from "@/lib/demo/visibility";
import { MentorProfilePanel } from "@/components/demos/MentorProfilePanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MentorPageProps {
  params: Promise<{ eventSlug: string; mentorId: string }>;
}

export default async function MentorPage({ params }: MentorPageProps) {
  const { eventSlug, mentorId } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  if (!SESSIONS_PAGE_ENABLED) redirect(`/${eventSlug}/agenda`);

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
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
  } catch {
    redirect(`/${eventSlug}`);
  }

  if (!settings.is_enabled) {
    redirect(`/${eventSlug}/agenda`);
  }

  const mentors = await getMentors(event.id);
  const mentor = mentors.find((m) => m.id === mentorId);
  if (!mentor || !mentor.is_mentor) notFound();

  const [allSlots, mySignup] = await Promise.all([
    getDemoSlotsWithCounts(event.id),
    supabase
      .from("demo_slot_signups")
      .select("slot_id")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  const mentorSlots = allSlots.filter((s) => s.mentor_id === mentorId);
  const availability = getDemoAvailability(settings, event.timezone || "America/Edmonton");

  return (
    <main className="max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
      <div>
        <Link
          href={`/${eventSlug}/sessions`}
          className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Sessions
        </Link>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Mentor</p>
          <h1 className="text-4xl font-light text-white tracking-tight">{mentor.name}</h1>
          {(mentor.title || mentor.company) && (
            <p className="text-sm text-gray-400">
              {mentor.title}
              {mentor.title && mentor.company ? " at " : ""}
              {mentor.company}
            </p>
          )}
        </div>
      </div>

      <MentorProfilePanel
        eventSlug={eventSlug}
        timezone={event.timezone || "America/Edmonton"}
        mentor={mentor}
        slots={mentorSlots}
        availability={availability}
        mySlotId={mySignup.data?.slot_id || null}
      />
    </main>
  );
}
