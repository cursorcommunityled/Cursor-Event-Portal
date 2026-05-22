import { notFound, redirect } from "next/navigation";
import { DemoSignupPanel } from "@/components/demos/DemoSignupPanel";
import { MentorCard } from "@/components/demos/MentorCard";
import { getEventBySlug, getMentors } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getDemoAvailability,
  getDemoSlotsWithCounts,
  getOrCreateDemoSettings,
} from "@/lib/demo/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SessionsPageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function SessionsPage({ params }: SessionsPageProps) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();

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

  const [slots, mySignup, mentors] = await Promise.all([
    getDemoSlotsWithCounts(event.id),
    supabase
      .from("demo_slot_signups")
      .select("slot_id")
      .eq("event_id", event.id)
      .eq("user_id", session.userId)
      .maybeSingle(),
    getMentors(event.id),
  ]);

  const availability = getDemoAvailability(settings, event.timezone || "America/Edmonton");
  const mySlotId = mySignup.data?.slot_id || null;
  const timezone = event.timezone || "America/Edmonton";

  // Separate mentor-assigned slots from unassigned
  const mentorSlotMap = new Map<string, typeof slots>();
  for (const slot of slots) {
    if (slot.mentor_id) {
      const existing = mentorSlotMap.get(slot.mentor_id) || [];
      existing.push(slot);
      mentorSlotMap.set(slot.mentor_id, existing);
    }
  }
  const visibleMentors = mentors.filter((m) =>
    mentorSlotMap.has(m.id) ||
    m.mentorship_mode === "in_person" ||
    m.mentorship_mode === "hybrid" ||
    !!m.in_person_schedule ||
    !!m.in_person_location
  );
  const unassignedSlots = slots.filter((s) => !s.mentor_id);

  return (
    <main className="max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">Sessions</p>
          <h1 className="text-4xl font-light text-white tracking-tight">Book a Session</h1>
          <p className="text-sm text-gray-500">
            Choose a mentor or builder session during the event.
          </p>
        </div>
        {settings.banner_image_url && (
          <div
            role="img"
            aria-label={`${event.name} session banner`}
            className="w-full h-20 sm:w-64 sm:h-20 sm:flex-shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(settings.banner_image_url)})` }}
          />
        )}
      </div>

      {/* Mentor cards */}
      {visibleMentors.length > 0 && (
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Meet the Mentors</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {visibleMentors.map((mentor) => {
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
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Unassigned slots (or full slot list if no mentors) */}
      {(unassignedSlots.length > 0 || visibleMentors.length === 0) && (
        <section className="space-y-4">
          {visibleMentors.length > 0 && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Other Sessions</p>
          )}
          <DemoSignupPanel
            eventSlug={eventSlug}
            timezone={timezone}
            availability={availability}
            speakerName={settings.speaker_name}
            slots={visibleMentors.length > 0 ? unassignedSlots : slots}
            mySlotId={mySlotId}
          />
        </section>
      )}

      {/* If all slots are mentor-assigned, still show availability status */}
      {visibleMentors.length > 0 && slots.length > 0 && unassignedSlots.length === 0 && (
        <div className="glass rounded-[32px] p-6 border-white/10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Session Booking</p>
          <p className="text-sm text-gray-300">{availability.message}</p>
        </div>
      )}
    </main>
  );
}
