import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getQuestions } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { SocialsSubNav } from "@/components/layout/SocialsSubNav";
import { QuestionsList } from "@/components/qa/QuestionsList";
import { QuestionForm } from "@/components/qa/QuestionForm";
import { createClient } from "@/lib/supabase/server";

interface SocialsQAPageProps {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export default async function SocialsQAPage({ params, searchParams }: SocialsQAPageProps) {
  const { eventSlug } = await params;
  const { sort } = await searchParams;

  const event = await getEventBySlug(eventSlug);
  if (!event) {
    notFound();
  }

  const session = await getSession();
  if (!session || session.eventId !== event.id) {
    redirect(`/${eventSlug}`);
  }

  const intakeStatus = await getIntakeStatus(event.id, session.userId);
  if (!intakeStatus.completed && !intakeStatus.skipped) {
    redirect(`/${eventSlug}/intake`);
  }

  const sortBy = sort === "new" ? "new" : "trending";
  const questions = await getQuestions(event.id, sortBy);

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  return (
    <main className="max-w-[40rem] mx-auto w-full px-6 py-12 space-y-12">
      <SocialsSubNav eventSlug={eventSlug} />

      <div className="flex items-end justify-between animate-fade-in">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
            Interact
          </p>
          <h1 className="text-4xl font-light text-white tracking-tight">
            Q&A
          </h1>
        </div>

        <div className="relative flex items-center bg-white/[0.03] border border-white/10 rounded-full p-1 backdrop-blur-sm">
          <a
            href={`/${eventSlug}/socials/qa?sort=trending`}
            className={`relative px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold rounded-full transition-all duration-300 z-10 ${
              sortBy === "trending"
                ? "bg-white text-black shadow-glow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Hot
          </a>
          <a
            href={`/${eventSlug}/socials/qa?sort=new`}
            className={`relative px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold rounded-full transition-all duration-300 z-10 ${
              sortBy === "new"
                ? "bg-white text-black shadow-glow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            New
          </a>
        </div>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <QuestionForm eventId={event.id} eventSlug={eventSlug} />
      </div>

      <QuestionsList
        initialQuestions={questions}
        eventSlug={eventSlug}
        eventId={event.id}
        userRole={user?.role}
        userId={session.userId}
        sortBy={sortBy}
      />
    </main>
  );
}
