import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEventBySlug, getHackathonMentors } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getDemoAvailability,
  getDemoSlotsWithCounts,
  getOrCreateDemoSettings,
} from "@/lib/demo/service";
import { MentorProfilePanel } from "@/components/demos/MentorProfilePanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ eventSlug: string; mentorId: string }>;
}

export default async function HackathonMentorPage({ params }: Props) {
  const { eventSlug, mentorId } = await params;

  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  if (!event.is_hackathon) redirect(`/${eventSlug}/hackathon`);

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const supabase = await createServiceClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!registration) {
    redirect(`/${eventSlug}`);
  }

  const mentors = await getHackathonMentors(event.id);
  const mentor = mentors.find((m) => m.id === mentorId);
  if (!mentor) notFound();

  const timezone = event.timezone || "America/Edmonton";

  let settings;
  try {
    settings = await getOrCreateDemoSettings(event);
  } catch {
    redirect(`/${eventSlug}/hackathon#mentors`);
  }

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
  const availability = getDemoAvailability(settings, timezone);

  return (
    <main className="max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
      <div>
        <Link
          href={`/${eventSlug}/hackathon#mentors`}
          className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Mentors
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
        timezone={timezone}
        mentor={mentor}
        slots={mentorSlots}
        availability={availability}
        mySlotId={mySignup.data?.slot_id || null}
      />
    </main>
  );
}
