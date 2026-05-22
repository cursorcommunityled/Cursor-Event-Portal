import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getHackathonJudges } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { createServiceClient } from "@/lib/supabase/server";
import { JudgeBadge } from "@/components/hackathon/JudgeBadge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ eventSlug: string }>;
}

export default async function HackathonJudgesPage({ params }: Props) {
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

  const judges = await getHackathonJudges(event.id);

  return (
    <main className="max-w-4xl mx-auto w-full px-6 py-12 space-y-12">
      <div className="space-y-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-amber-500/80 font-medium">Hackathon</p>
        <h1 className="text-5xl font-light text-white tracking-tight">The Judges</h1>
        <p className="text-base text-gray-400 max-w-xl mx-auto">
          Meet the panel of industry experts who will be evaluating tonight&apos;s projects.
        </p>
      </div>

      {judges.length > 0 ? (
        <section className="space-y-6">
          {judges.map((judge) => (
            <JudgeBadge key={judge.id} judge={judge} />
          ))}
        </section>
      ) : (
        <div className="glass rounded-[32px] p-8 border-white/10 text-center">
          <p className="text-sm text-gray-500">Judges will be announced soon.</p>
        </div>
      )}
    </main>
  );
}
