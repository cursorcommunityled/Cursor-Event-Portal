import { notFound, redirect } from "next/navigation";
import { MentorCard } from "@/components/demos/MentorCard";
import { getEventBySlug, getHackathonMentors } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getDemoAvailability,
  getDemoSlotsWithCounts,
  getOrCreateDemoSettings,
} from "@/lib/demo/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function HackathonMentorsPage({ params }: Props) {
  const { eventSlug } = await params;

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
    .select("checked_in_at")
    .eq("event_id", event.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!registration?.checked_in_at) {
    redirect(`/${eventSlug}`);
  }

  const mentors = await getHackathonMentors(event.id);
  const timezone = event.timezone || "America/Edmonton";

  // Try to load slot data for online mentors (optional — page still works without it)
  let availability = null;
  let slots: Awaited<ReturnType<typeof getDemoSlotsWithCounts>> = [];
  let mySlotId: string | null = null;
  try {
    const settings = await getOrCreateDemoSettings(event);
    if (settings.is_enabled) {
      const [slotsData, mySignup] = await Promise.all([
        getDemoSlotsWithCounts(event.id),
        supabase
          .from("demo_slot_signups")
          .select("slot_id")
          .eq("event_id", event.id)
          .eq("user_id", session.userId)
          .maybeSingle(),
      ]);
      slots = slotsData;
      mySlotId = mySignup.data?.slot_id || null;
      availability = getDemoAvailability(settings, timezone);
    }
  } catch {
    // Sessions not configured — online booking section simply won't appear
  }

  // Build mentor → slots map
  const mentorSlotMap = new Map<string, typeof slots>();
  for (const slot of slots) {
    if (slot.mentor_id) {
      const existing = mentorSlotMap.get(slot.mentor_id) || [];
      existing.push(slot);
      mentorSlotMap.set(slot.mentor_id, existing);
    }
  }

  const liveMentors = mentors.filter(
    (m) => m.mentorship_mode === "in_person" || m.mentorship_mode === "hybrid"
  );
  const onlineMentors = mentors.filter((m) => m.mentorship_mode === "virtual");

  return (
    <main className="max-w-2xl mx-auto w-full px-6 py-12 space-y-10">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Hackathon</p>
        <h1 className="text-4xl font-light text-white tracking-tight">Mentors</h1>
        <p className="text-sm text-gray-500">
          Get guidance from industry experts throughout the event.
        </p>
      </div>

      {/* Live / in-person mentors */}
      {liveMentors.length > 0 && (
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Live Tonight</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {liveMentors.map((mentor) => {
              const mentorSlots = mentorSlotMap.get(mentor.id) || [];
              const availableSlots = mentorSlots.filter((s) => !s.is_full).length;
              const isBooked = mentorSlots.some((s) => s.id === mySlotId);
              return (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  eventSlug={eventSlug}
                  availableSlots={availableSlots}
                  isBooked={isBooked}
                  basePath="hackathon"
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Online / bookable mentors */}
      {onlineMentors.length > 0 && (
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Book Online</p>
          {availability && (
            <p className="text-xs text-gray-500">{availability.message}</p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {onlineMentors.map((mentor) => {
              const mentorSlots = mentorSlotMap.get(mentor.id) || [];
              const availableSlots = mentorSlots.filter((s) => !s.is_full).length;
              const isBooked = mentorSlots.some((s) => s.id === mySlotId);
              return (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  eventSlug={eventSlug}
                  availableSlots={availableSlots}
                  isBooked={isBooked}
                  basePath="hackathon"
                />
              );
            })}
          </div>
        </section>
      )}

      {mentors.length === 0 && (
        <div className="glass rounded-[32px] p-8 border-white/10 text-center">
          <p className="text-sm text-gray-500">Mentors will be announced soon.</p>
        </div>
      )}
    </main>
  );
}
