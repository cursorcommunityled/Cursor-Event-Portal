import { getQuestionsForAdmin, getAllPolls, getAnnouncements, getAllSurveys, getHelpRequestsForAdmin, getExchangePosts, getNetworkingSession, getNetworkingCurrentRound, getNetworkingPairsForRound } from "@/lib/supabase/queries";
import { EventSocialClient } from "../../_clients/[adminCode]/social/EventSocialClient";
import { getEventForAdmin } from "@/lib/utils/admin";

interface EventSocialPageProps {
  params: Promise<{ adminCode: string }>;
  searchParams: Promise<{ sort?: string; status?: string; tab?: string }>;
}

export default async function EventSocialPage({ params, searchParams }: EventSocialPageProps) {
  const { adminCode } = await params;
  const { sort, status, tab } = await searchParams;
  const event = await getEventForAdmin(adminCode);

  const sortBy = sort === "new" ? "new" : "trending";
  const statusFilter = (status === "answered" || status === "hidden" || status === "pinned" || status === "open") ? status : "all";
  // Map legacy tab names and validate against new tab types
  const tabMap: Record<string, string> = {
    help: "qa",
    exchange: "connect",
    networking: "connect",
    surveys: "follow-up",
  };
  const resolvedTab = tabMap[tab ?? ""] ?? tab;
  const activeTab = (resolvedTab === "qa" || resolvedTab === "connect" || resolvedTab === "follow-up" || resolvedTab === "polls" || resolvedTab === "announcements" || resolvedTab === "copilot") ? resolvedTab : "copilot";

  const [questions, polls, announcements, surveys, helpRequests, exchangePosts, networkingSession] = await Promise.all([
    getQuestionsForAdmin(event.id, sortBy, true),
    getAllPolls(event.id),
    getAnnouncements(event.id),
    getAllSurveys(event.id),
    getHelpRequestsForAdmin(event.id),
    getExchangePosts(event.id),
    getNetworkingSession(event.id),
  ]);

  const networkingRound = networkingSession ? await getNetworkingCurrentRound(networkingSession.id) : null;
  const networkingPairs = networkingRound ? await getNetworkingPairsForRound(networkingRound.id) : [];

  return (
    <EventSocialClient
      event={event}
      eventSlug={event.slug}
      adminCode={adminCode}
      userId={undefined}
      initialQuestions={questions}
      initialPolls={polls}
      initialAnnouncements={announcements}
      initialSurveys={surveys}
      initialHelpRequests={helpRequests}
      initialExchangePosts={exchangePosts}
      initialNetworkingSession={networkingSession}
      initialNetworkingRound={networkingRound}
      initialNetworkingPairs={networkingPairs}
      sortBy={sortBy}
      statusFilter={statusFilter as any}
      activeTab={activeTab as any}
    />
  );
}
