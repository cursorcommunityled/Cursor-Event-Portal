import { notFound, redirect } from "next/navigation";
import { getEventBySlug, getQuestions, getHelpRequests } from "@/lib/supabase/queries";
import { getSession } from "@/lib/actions/registration";
import { getIntakeStatus } from "@/lib/actions/intake";
import { SocialsSubNav } from "@/components/layout/SocialsSubNav";
import { QuestionsList } from "@/components/qa/QuestionsList";
import { QuestionForm } from "@/components/qa/QuestionForm";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";
import { HelpRequestList } from "@/components/help/HelpRequestList";
import { createClient } from "@/lib/supabase/server";

interface SocialsQAPageProps {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ sort?: string; view?: string }>;
}

export default async function SocialsQAPage({ params, searchParams }: SocialsQAPageProps) {
  const { eventSlug } = await params;
  const { sort, view } = await searchParams;

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

  const activeView = view === "help" ? "help" : "qa";
  const sortBy = sort === "new" ? "new" : "trending";

  const [questions, helpRequests] = await Promise.all([
    getQuestions(event.id, sortBy),
    getHelpRequests(event.id, session.userId),
  ]);

  const { data: user } = await (await createClient())
    .from("users")
    .select("role")
    .eq("id", session.userId)
    .single();

  return (
    <main className="max-w-[40rem] mx-auto w-full px-6 py-12 space-y-12">
      <SocialsSubNav eventSlug={eventSlug} />

      {/* Inner sub-toggle */}
      <div className="flex items-center gap-2 animate-fade-in">
        <a
          href={`/${eventSlug}/socials/qa`}
          className={`px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-300 ${
            activeView === "qa"
              ? "bg-white text-black shadow-glow"
              : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
          }`}
        >
          Questions
        </a>
        <a
          href={`/${eventSlug}/socials/qa?view=help`}
          className={`px-5 py-2.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-300 ${
            activeView === "help"
              ? "bg-white text-black shadow-glow"
              : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
          }`}
        >
          Help Desk
        </a>
      </div>

      {activeView === "qa" && (
        <>
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
        </>
      )}

      {activeView === "help" && (
        <>
          <div className="flex items-end justify-between animate-fade-in">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.4em] text-gray-600 font-medium">
                Support
              </p>
              <h1 className="text-4xl font-light text-white tracking-tight">
                Help Desk
              </h1>
            </div>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <HelpRequestForm eventId={event.id} eventSlug={eventSlug} />
          </div>

          <HelpRequestList initialRequests={helpRequests} eventId={event.id} userId={session.userId} />
        </>
      )}
    </main>
  );
}
