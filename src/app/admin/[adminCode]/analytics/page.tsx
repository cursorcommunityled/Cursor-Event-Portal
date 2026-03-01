import { IntelligenceHubClient } from "../../_clients/[adminCode]/analytics/IntelligenceHubClient";
import { getEventForAdmin } from "@/lib/utils/admin";
import {
  getCheckInCurve, getQAAnalytics, getPollParticipation, getIntakeAnalytics, getSeriesAttendanceData,
  getEventRegistrations, getQuestions, getPublishedSurvey, getSurveyResponses,
} from "@/lib/supabase/queries";

export const revalidate = 0;

interface AnalyticsPageProps {
  params: Promise<{ adminCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const { adminCode } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "data" ? "data" : "analytics";

  const event = await getEventForAdmin(adminCode);

  const [checkInCurve, qaAnalytics, pollParticipation, intakeAnalytics, registrations, questions, survey] = await Promise.all([
    getCheckInCurve(event.id),
    getQAAnalytics(event.id),
    getPollParticipation(event.id),
    getIntakeAnalytics(event.id),
    getEventRegistrations(event.id),
    getQuestions(event.id),
    getPublishedSurvey(event.id),
  ]);

  const [seriesAttendanceData, surveyResponses] = await Promise.all([
    event.series_id ? getSeriesAttendanceData(event.series_id) : Promise.resolve(null),
    survey ? getSurveyResponses(survey.id) : Promise.resolve([]),
  ]);

  return (
    <IntelligenceHubClient
      event={event}
      eventSlug={event.slug}
      adminCode={adminCode}
      checkInCurve={checkInCurve}
      qaAnalytics={qaAnalytics}
      pollParticipation={pollParticipation}
      intakeAnalytics={intakeAnalytics}
      seriesAttendanceData={seriesAttendanceData || undefined}
      registrations={registrations}
      questions={questions}
      survey={survey}
      surveyResponses={surveyResponses}
      activeTab={activeTab}
    />
  );
}
