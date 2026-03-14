/**
 * Mock query layer — returns sample data without a real Supabase connection.
 * Activated when NEXT_PUBLIC_USE_MOCK_DATA=true in .env.local
 */

import type {
  Event,
  User,
  Registration,
  AgendaItem,
  Announcement,
  Question,
  HelpRequest,
  Survey,
  SurveyResponse,
  AttendeeIntake,
  SuggestedGroup,
  Poll,
  PollWithVotes,
  SlideDeck,
  TableQRCode,
  TableRegistration,
  Competition,
  CompetitionWithEntries,
  ConversationTheme,
  EventThemeSelection,
  PlannedEvent,
  EventCalendarCity,
  Venue,
  ExchangePost,
  CursorCredit,
  SpeedNetworkingSession,
  SpeedNetworkingRound,
  SpeedNetworkingPair,
} from "@/types";

import {
  MOCK_EVENT,
  MOCK_USERS,
  MOCK_REGISTRATIONS,
  MOCK_AGENDA,
  MOCK_ANNOUNCEMENTS,
  MOCK_QUESTIONS,
  MOCK_HELP_REQUESTS,
  MOCK_POLLS_WITH_VOTES,
  MOCK_SURVEY,
  MOCK_INTAKES,
  MOCK_GROUPS,
  MOCK_COMPETITIONS,
  MOCK_THEMES,
  MOCK_THEME_SELECTION,
  MOCK_PLANNED_EVENTS,
  MOCK_VENUES,
  MOCK_CITIES,
  MOCK_EXCHANGE_POSTS,
  MOCK_TABLE_QR_CODES,
  MOCK_TABLE_REGISTRATIONS,
  MOCK_NETWORKING_SESSION,
  MOCK_CURSOR_CREDITS,
} from "./data";

// ─── Re-exported types (matches real queries.ts public surface) ────────────────

export type EventSummary = Pick<Event, "id" | "slug" | "name" | "venue" | "start_time" | "status"> & {
  theme_title?: string | null;
};

export interface SeriesEventSummary {
  id: string;
  slug: string;
  name: string;
  start_time: string | null;
  status: string;
  registered: number;
  checked_in: number;
}

export interface CheckInDataPoint {
  time: string;
  count: number;
  cumulative: number;
}

export interface QAAnalytics {
  mostUpvoted: Question[];
  unansweredAging: Array<{ question: Question; ageMinutes: number }>;
}

export interface PollParticipation {
  pollId: string;
  pollTitle: string;
  totalVotes: number;
  participationRate: number;
  checkedInCount: number;
}

export interface IntakeAnalytics {
  completionRate: number;
  dropOffRate: number;
  started: number;
  completed: number;
  skipped: number;
  total: number;
}

export interface SeriesAttendanceDataPoint {
  name: string;
  start_time: string | null;
  registered: number;
  checked_in: number;
}

// ─── Event queries ────────────────────────────────────────────────────────────

export async function getEventBySlug(slug: string): Promise<Event | null> {
  if (slug === MOCK_EVENT.slug) return MOCK_EVENT;
  return MOCK_EVENT; // fallback for demo
}

export async function getEventByAdminCode(adminCode: string): Promise<Event | null> {
  if (adminCode === MOCK_EVENT.admin_code) return MOCK_EVENT;
  return MOCK_EVENT; // fallback for demo
}

export async function getActiveEventSlug(): Promise<string> {
  return MOCK_EVENT.slug;
}

export async function getActiveEventAdminCode(): Promise<string | null> {
  return MOCK_EVENT.admin_code;
}

export async function getAllEvents(): Promise<EventSummary[]> {
  return [{ ...MOCK_EVENT, theme_title: "Cursor Tips & Tricks" }];
}

export async function getEventStats(eventId: string) {
  return { registered: MOCK_REGISTRATIONS.length, checkedIn: MOCK_REGISTRATIONS.filter(r => r.checked_in_at).length };
}

// ─── User queries ─────────────────────────────────────────────────────────────

export async function getUserById(id: string): Promise<User | null> {
  return MOCK_USERS.find(u => u.id === id) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return MOCK_USERS.find(u => u.email === email) ?? null;
}

// ─── Registration queries ─────────────────────────────────────────────────────

export async function getRegistration(eventId: string, userId: string): Promise<Registration | null> {
  return MOCK_REGISTRATIONS.find(r => r.event_id === eventId && r.user_id === userId) ?? null;
}

export async function getEventRegistrations(eventId: string): Promise<Registration[]> {
  return MOCK_REGISTRATIONS;
}

export async function searchRegistrations(eventId: string, query: string): Promise<Registration[]> {
  const q = query.toLowerCase();
  return MOCK_REGISTRATIONS.filter(r => r.user?.name.toLowerCase().includes(q) || r.user?.email?.toLowerCase().includes(q));
}

export async function getEventAttendees(eventId: string): Promise<{ id: string; name: string; email: string | null }[]> {
  return MOCK_USERS.map(u => ({ id: u.id, name: u.name, email: u.email ?? null }));
}

// ─── Agenda queries ───────────────────────────────────────────────────────────

export async function getAgendaItems(eventId: string): Promise<AgendaItem[]> {
  return MOCK_AGENDA;
}

export async function getSeriesEvents(seriesId: string): Promise<SeriesEventSummary[]> {
  return [{ id: MOCK_EVENT.id, slug: MOCK_EVENT.slug, name: MOCK_EVENT.name, start_time: MOCK_EVENT.start_time, status: MOCK_EVENT.status, registered: 7, checked_in: 6 }];
}

// ─── Announcement queries ─────────────────────────────────────────────────────

export async function getAnnouncements(eventId: string): Promise<Announcement[]> {
  return MOCK_ANNOUNCEMENTS;
}

// ─── Q&A queries ──────────────────────────────────────────────────────────────

export async function getQuestions(eventId: string, sort: "trending" | "new" = "trending", includeHidden = false): Promise<Question[]> {
  const q = MOCK_QUESTIONS.filter(q => includeHidden || q.status !== "hidden");
  return sort === "new" ? [...q].sort((a, b) => b.created_at.localeCompare(a.created_at)) : [...q].sort((a, b) => b.upvotes - a.upvotes);
}

export async function getQuestionsForAdmin(eventId: string, sort: "trending" | "new" = "trending", includeHidden = true): Promise<Question[]> {
  return getQuestions(eventId, sort, includeHidden);
}

export async function getQuestionById(id: string): Promise<Question | null> {
  return MOCK_QUESTIONS.find(q => q.id === id) ?? null;
}

// ─── Help queries ─────────────────────────────────────────────────────────────

export async function getHelpRequests(eventId: string, userId?: string): Promise<HelpRequest[]> {
  return userId ? MOCK_HELP_REQUESTS.filter(h => h.user_id === userId) : MOCK_HELP_REQUESTS;
}

export async function getHelpRequestsForAdmin(eventId: string): Promise<HelpRequest[]> {
  return MOCK_HELP_REQUESTS;
}

// ─── Survey queries ───────────────────────────────────────────────────────────

export async function getPublishedSurvey(eventId: string): Promise<Survey | null> {
  return MOCK_SURVEY;
}

export async function getAllSurveys(eventId: string): Promise<Survey[]> {
  return [MOCK_SURVEY];
}

export async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  return [];
}

// ─── Intake queries ───────────────────────────────────────────────────────────

export async function getAttendeeIntake(eventId: string, userId: string): Promise<AttendeeIntake | null> {
  return MOCK_INTAKES.find(i => i.user_id === userId) ?? null;
}

export async function getEventIntakes(eventId: string): Promise<AttendeeIntake[]> {
  return MOCK_INTAKES;
}

// ─── Group queries ────────────────────────────────────────────────────────────

export async function getSuggestedGroups(eventId: string): Promise<SuggestedGroup[]> {
  return MOCK_GROUPS;
}

// ─── Table queries ────────────────────────────────────────────────────────────

export async function getTableQRCodes(eventId: string): Promise<TableQRCode[]> {
  return MOCK_TABLE_QR_CODES;
}

export async function getTableRegistration(eventId: string, userId: string): Promise<TableRegistration | null> {
  return MOCK_TABLE_REGISTRATIONS.find(t => t.event_id === eventId && t.user_id === userId) ?? null;
}

export async function getTableRegistrations(eventId: string): Promise<TableRegistration[]> {
  return MOCK_TABLE_REGISTRATIONS;
}

// ─── Slide deck queries ───────────────────────────────────────────────────────

export async function getSlideDeck(eventId: string): Promise<SlideDeck | null> {
  return null;
}

// ─── Display page ─────────────────────────────────────────────────────────────

export async function getDisplayPageData(eventId: string) {
  const now = new Date();
  const current = MOCK_AGENDA.find(a => a.start_time && a.end_time && new Date(a.start_time) <= now && new Date(a.end_time) >= now) ?? null;
  const next = MOCK_AGENDA.find(a => a.start_time && new Date(a.start_time) > now) ?? null;
  return { event: MOCK_EVENT, currentSession: current, nextSession: next, recentQuestions: MOCK_QUESTIONS.slice(0, 3), announcements: MOCK_ANNOUNCEMENTS, slideDeck: null };
}

// ─── Poll queries ─────────────────────────────────────────────────────────────

export async function getActivePolls(eventId: string): Promise<Poll[]> {
  return MOCK_POLLS_WITH_VOTES.filter(p => p.is_active);
}

export async function getAllPolls(eventId: string): Promise<Poll[]> {
  return MOCK_POLLS_WITH_VOTES;
}

export async function getPollWithVotes(pollId: string, userId?: string): Promise<PollWithVotes | null> {
  return MOCK_POLLS_WITH_VOTES.find(p => p.id === pollId) ?? null;
}

export async function getActivePollsWithVotes(eventId: string, userId?: string): Promise<PollWithVotes[]> {
  return MOCK_POLLS_WITH_VOTES.filter(p => p.is_active);
}

// ─── Analytics queries ────────────────────────────────────────────────────────

export async function getSeriesAttendanceData(seriesId: string): Promise<SeriesAttendanceDataPoint[]> {
  return [{ name: "Jan 2026", start_time: "2026-01-21T18:00:00-07:00", registered: 65, checked_in: 58 }, { name: "Feb 2026", start_time: "2026-02-18T18:00:00-07:00", registered: 80, checked_in: 74 }];
}

export async function getCheckInCurve(eventId: string): Promise<CheckInDataPoint[]> {
  return [
    { time: "2026-02-18T18:00:00-07:00", count: 12, cumulative: 12 },
    { time: "2026-02-18T18:15:00-07:00", count: 18, cumulative: 30 },
    { time: "2026-02-18T18:30:00-07:00", count: 22, cumulative: 52 },
    { time: "2026-02-18T18:45:00-07:00", count: 14, cumulative: 66 },
    { time: "2026-02-18T19:00:00-07:00", count: 8, cumulative: 74 },
  ];
}

export async function getQAAnalytics(eventId: string): Promise<QAAnalytics> {
  const mostUpvoted = [...MOCK_QUESTIONS].sort((a, b) => b.upvotes - a.upvotes).slice(0, 3);
  const unanswered = MOCK_QUESTIONS.filter(q => !q.answers?.length);
  return { mostUpvoted, unansweredAging: unanswered.map(q => ({ question: q, ageMinutes: 45 })) };
}

export async function getPollParticipation(eventId: string): Promise<PollParticipation[]> {
  return MOCK_POLLS_WITH_VOTES.map(p => ({ pollId: p.id, pollTitle: p.question, totalVotes: p.total_votes, participationRate: 75, checkedInCount: 6 }));
}

export async function getIntakeAnalytics(eventId: string): Promise<IntakeAnalytics> {
  return { completionRate: 83, dropOffRate: 17, started: 6, completed: 5, skipped: 0, total: 6 };
}

// ─── Competition queries ──────────────────────────────────────────────────────

export async function getActiveCompetitions(eventId: string): Promise<CompetitionWithEntries[]> {
  return MOCK_COMPETITIONS.filter(c => ["active", "voting", "ended"].includes(c.status));
}

export async function getAllCompetitions(eventId: string): Promise<CompetitionWithEntries[]> {
  return MOCK_COMPETITIONS;
}

export async function getCompetitionWithEntries(competitionId: string, userId?: string): Promise<CompetitionWithEntries | null> {
  return MOCK_COMPETITIONS.find(c => c.id === competitionId) ?? null;
}

// ─── Conversation theme queries ───────────────────────────────────────────────

export async function getConversationThemes(): Promise<ConversationTheme[]> {
  return MOCK_THEMES;
}

export async function getEventThemeSelection(eventId: string): Promise<EventThemeSelection | null> {
  return MOCK_THEME_SELECTION;
}

// ─── Planned events queries ───────────────────────────────────────────────────

export async function getPlannedEvents(): Promise<PlannedEvent[]> {
  return MOCK_PLANNED_EVENTS;
}

// ─── Venue queries ────────────────────────────────────────────────────────────

export async function getVenues(): Promise<Venue[]> {
  return MOCK_VENUES;
}

// ─── Calendar city queries ────────────────────────────────────────────────────

export async function getEventCalendarCities(): Promise<EventCalendarCity[]> {
  return MOCK_CITIES;
}

// ─── Cursor credit queries ────────────────────────────────────────────────────

export async function getCursorCredits(eventId: string): Promise<CursorCredit[]> {
  return MOCK_CURSOR_CREDITS;
}

export async function getCursorCredit(eventId: string, userId: string): Promise<CursorCredit | null> {
  return MOCK_CURSOR_CREDITS.find(c => c.event_id === eventId && c.assigned_to === userId) ?? null;
}

// ─── Networking queries ───────────────────────────────────────────────────────

export async function getNetworkingSession(eventId: string): Promise<SpeedNetworkingSession | null> {
  return MOCK_NETWORKING_SESSION;
}

export async function getNetworkingCurrentRound(sessionId: string): Promise<SpeedNetworkingRound | null> {
  return null;
}

export async function getNetworkingPairsForRound(roundId: string): Promise<SpeedNetworkingPair[]> {
  return [];
}

export async function getUserNetworkingPair(roundId: string, userId: string): Promise<SpeedNetworkingPair | null> {
  return null;
}

// ─── Exchange board queries ───────────────────────────────────────────────────

export async function getExchangePosts(eventId: string): Promise<ExchangePost[]> {
  return MOCK_EXCHANGE_POSTS;
}

export async function getOpenExchangePosts(eventId: string): Promise<ExchangePost[]> {
  return MOCK_EXCHANGE_POSTS.filter(p => p.status === "open");
}
