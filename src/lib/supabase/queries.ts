import { createClient, createServiceClient } from "./server";
import { createClient as createDirectClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Event,
  User,
  UserRole,
  Registration,
  AgendaItem,
  Announcement,
  Question,
  Answer,
  HelpRequest,
  Survey,
  SurveyResponse,
  AttendeeIntake,
  SuggestedGroup,
  DisplayPageData,
  Poll,
  PollVote,
  PollWithVotes,
  SlideDeck,
  TableQRCode,
  TableRegistration,
  Competition,
  CompetitionEntry,
  CompetitionWithEntries,
  ConversationTheme,
  EventThemeSelection,
  PlannedEvent,
  EventCalendarCity,
  Venue,
  EventPhoto,
  PhotoStatus,
} from "@/types";

// Event queries
// Use limit(1) + take first row so we don't get PGRST116 when there are 0 or 2+ rows for a slug
export async function getEventBySlug(slug: string): Promise<Event | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const fetchOne = async (
    client: ReturnType<typeof createDirectClient>
  ): Promise<Event | null> => {
    const { data, error } = await client
      .from("events")
      .select("*")
      .eq("slug", slug)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as Event;
  };

  if (url && serviceKey) {
    try {
      const event = await fetchOne(createDirectClient(url, serviceKey));
      if (event) return event;
    } catch {
      // fall through
    }
  }

  try {
    const event = await fetchOne(createDirectClient(url, anonKey));
    if (event) return event;
  } catch {
    // ignore
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .limit(1);
    if (!error && data?.length) return data[0] as Event;
  } catch {
    // ignore
  }
  return null;
}

/** Look up an event by its admin_code (unique). Used for simplified admin URLs. */
export async function getEventByAdminCode(adminCode: string): Promise<Event | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const fetchOne = async (
    client: ReturnType<typeof createDirectClient>
  ): Promise<Event | null> => {
    const { data, error } = await client
      .from("events")
      .select("*")
      .eq("admin_code", adminCode)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as Event;
  };

  if (url && serviceKey) {
    try {
      const event = await fetchOne(createDirectClient(url, serviceKey));
      if (event) return event;
    } catch { /* fall through */ }
  }
  try {
    const event = await fetchOne(createDirectClient(url, anonKey));
    if (event) return event;
  } catch { /* ignore */ }
  return null;
}

/** Slug of the event currently shown to attendees (homepage link, etc.). Defaults to calgary-feb-2026 if unset. */
export async function getActiveEventSlug(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  try {
    const directSupabase = createDirectClient(url, anonKey);
    const { data } = await directSupabase
      .from("app_settings")
      .select("value")
      .eq("key", "active_event_slug")
      .single();
    if (data?.value) return data.value;
  } catch {
    // ignore
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "active_event_slug")
      .single();
    if (data?.value) return data.value;
  } catch {
    // ignore
  }
  // Last resort: return the most recently started event's slug
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("slug")
      .order("start_time", { ascending: false })
      .limit(1)
      .single();
    if (data?.slug) return data.slug;
  } catch {
    // ignore
  }
  return "";
}

/** Admin code of the active event (for /admin → /admin/[code] redirects). Returns null if not found. */
export async function getActiveEventAdminCode(): Promise<string | null> {
  const slug = await getActiveEventSlug();
  const event = await getEventBySlug(slug);
  return event?.admin_code ?? null;
}

/** All events (for admin venue/event selector), including active theme title and admin_code. */
export type EventSummary = Pick<Event, "id" | "slug" | "name" | "venue" | "start_time" | "status"> & {
  themeTitle?: string | null;
  admin_code?: string | null;
};

export async function getAllEvents(): Promise<EventSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, slug, name, venue, start_time, status, admin_code")
    .order("start_time", { ascending: false });
  if (error) return [];

  const events = (data ?? []).map((ev: any) => ({
    id: ev.id,
    slug: ev.slug,
    name: ev.name,
    venue: ev.venue,
    start_time: ev.start_time,
    status: ev.status,
    admin_code: ev.admin_code,
    themeTitle: null as string | null,
  }));

  // Best-effort: attach active theme titles (requires themes migration to be run)
  const { data: selections } = await supabase
    .from("event_theme_selections")
    .select("event_id, theme:conversation_themes(title)");
  if (selections) {
    const themeMap = new Map(
      selections.map((s: any) => [s.event_id, s.theme?.title ?? null])
    );
    events.forEach((ev) => { ev.themeTitle = themeMap.get(ev.id) ?? null; });
  }

  return events;
}

export async function getEventStats(eventId: string) {
  const supabase = await createClient();

  const [registrationsResult, checkedInResult] = await Promise.all([
    supabase
      .from("registrations")
      .select("id", { count: "exact" })
      .eq("event_id", eventId),
    supabase
      .from("registrations")
      .select("id", { count: "exact" })
      .eq("event_id", eventId)
      .not("checked_in_at", "is", null),
  ]);

  return {
    registered: registrationsResult.count || 0,
    checkedIn: checkedInResult.count || 0,
  };
}

// User queries
export async function getUserById(id: string): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) return null;
  return data;
}

// Registration queries
export async function getRegistration(
  eventId: string,
  userId: string
): Promise<Registration | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*, user:users(*)")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function getEventRegistrations(
  eventId: string
): Promise<Registration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*, user:users(*, intakes:attendee_intakes(*))")
    .eq("event_id", eventId)
    .eq("user.intakes.event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEventRegistrations] Error:", error);
    return [];
  }
  return data;
}

export async function searchRegistrations(
  eventId: string,
  query: string
): Promise<Registration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*, user:users(*, intakes:attendee_intakes(*))")
    .eq("event_id", eventId)
    .eq("user.intakes.event_id", eventId)
    .or(`user.name.ilike.%${query}%,user.email.ilike.%${query}%`);

  if (error) return [];
  return data;
}

// Get registered attendees for check-in
export async function getEventAttendees(
  eventId: string
): Promise<{ id: string; name: string; email: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("user:users(id, name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  
  // Flatten the nested user object
  return data
    .filter((r) => r.user)
    .map((r) => {
      // Handle both array and object cases from Supabase
      const user = Array.isArray(r.user) ? r.user[0] : r.user;
      if (!user || typeof user !== 'object') return null;
      
      return {
        id: String(user.id),
        name: String(user.name),
        email: user.email ? String(user.email) : null,
      };
    })
    .filter((user): user is { id: string; name: string; email: string | null } => user !== null);
}

// Agenda queries
export async function getAgendaItems(eventId: string): Promise<AgendaItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda_items")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return data;
}

export interface SeriesEventSummary {
  id: string;
  slug: string;
  name: string;
  start_time: string | null;
  venue: string | null;
  status: string;
  registration_count: number;
}

export async function getSeriesEvents(seriesId: string): Promise<SeriesEventSummary[]> {
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, slug, name, start_time, venue, status")
    .eq("series_id", seriesId)
    .order("start_time", { ascending: true });

  if (error || !events) {
    console.error("[getSeriesEvents] Error fetching events:", error);
    return [];
  }

  const eventIds = events.map((event) => event.id);
  if (eventIds.length === 0) return [];

  const { data: registrations, error: regError } = await supabase
    .from("registrations")
    .select("event_id")
    .in("event_id", eventIds);

  if (regError) {
    console.error("[getSeriesEvents] Error fetching registrations:", regError);
  }

  const counts = new Map<string, number>();
  (registrations || []).forEach((reg) => {
    counts.set(reg.event_id, (counts.get(reg.event_id) || 0) + 1);
  });

  return events.map((event) => ({
    ...event,
    registration_count: counts.get(event.id) || 0,
  }));
}

// Announcement queries
export async function getAnnouncements(eventId: string): Promise<Announcement[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("event_id", eventId)
    .not("published_at", "is", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`) // Only get announcements that haven't expired
    .order("priority", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) return [];
  return data;
}

// Question queries
// Calculate a "hot score" for trending questions
// Formula: (upvotes * 2 + answers_count * 1.5) / (hours_since_creation + 2)^1.5
// This gives a boost to recent questions and those with engagement
function calculateHotScore(question: Question): number {
  const upvotes = question.upvotes || 0;
  const answersCount = question.answers?.length || 0;
  const createdAt = new Date(question.created_at);
  const now = new Date();
  const hoursSinceCreation = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  
  // Hot score: engagement weighted by recency
  const engagement = upvotes * 2 + answersCount * 1.5;
  const timeDecay = Math.pow(hoursSinceCreation + 2, 1.5);
  return engagement / timeDecay;
}

export async function getQuestions(
  eventId: string,
  sort: "trending" | "new" = "trending",
  includeHidden: boolean = false
): Promise<Question[]> {
  const supabase = await createClient();
  // Explicitly specify the relationship to avoid ambiguity with question_upvotes
  const query = supabase
    .from("questions")
    .select("*, user:users!questions_user_id_fkey(*), answers(*, user:users!answers_user_id_fkey(*))")
    .eq("event_id", eventId);

  if (!includeHidden) {
    query.neq("status", "hidden");
  }

  // For "new", just order by created_at
  if (sort === "new") {
    query.order("created_at", { ascending: false });
  } else {
    // For "trending", fetch all and sort by hot score
    query.order("created_at", { ascending: false }); // Get all first
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getQuestions] Error fetching questions:", error);
    return [];
  }

  // If trending, sort by hot score
  if (sort === "trending" && data) {
    return data.sort((a, b) => {
      const scoreA = calculateHotScore(a);
      const scoreB = calculateHotScore(b);
      return scoreB - scoreA; // Descending order
    });
  }

  return data || [];
}

// Admin version that bypasses RLS to see all questions
export async function getQuestionsForAdmin(
  eventId: string,
  sort: "trending" | "new" = "trending",
  includeHidden: boolean = true
): Promise<Question[]> {
  console.log("[getQuestionsForAdmin] Fetching questions for admin, eventId:", eventId);
  const supabase = await createServiceClient();
  // Explicitly specify the relationship to avoid ambiguity with question_upvotes
  const query = supabase
    .from("questions")
    .select("*, user:users!questions_user_id_fkey(*), answers(*, user:users!answers_user_id_fkey(*))")
    .eq("event_id", eventId);

  if (!includeHidden) {
    query.neq("status", "hidden");
  }

  // For "new", just order by created_at
  if (sort === "new") {
    query.order("created_at", { ascending: false });
  } else {
    // For "trending", fetch all and sort by hot score
    query.order("created_at", { ascending: false }); // Get all first
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getQuestionsForAdmin] Error fetching questions:", error);
    return [];
  }

  // If trending, sort by hot score
  if (sort === "trending" && data) {
    const sorted = data.sort((a, b) => {
      const scoreA = calculateHotScore(a);
      const scoreB = calculateHotScore(b);
      return scoreB - scoreA; // Descending order
    });
    console.log("[getQuestionsForAdmin] Found", sorted.length, "questions, sorted by hot score");
    return sorted;
  }

  console.log("[getQuestionsForAdmin] Found", data?.length || 0, "questions");
  return data || [];
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const supabase = await createClient();
  // Explicitly specify the relationship to avoid ambiguity with question_upvotes
  const { data, error } = await supabase
    .from("questions")
    .select("*, user:users!questions_user_id_fkey(*), answers(*, user:users!answers_user_id_fkey(*))")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

// Help request queries
export async function getHelpRequests(eventId: string, userId?: string): Promise<HelpRequest[]> {
  const supabase = await createClient();
  const query = supabase
    .from("help_requests")
    .select("*, user:users!help_requests_user_id_fkey(*), claimer:users!help_requests_claimed_by_fkey(*)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (userId) {
    query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getHelpRequests] Error fetching help requests:", error);
    return [];
  }
  return data || [];
}

export async function getHelpRequestsForAdmin(eventId: string): Promise<HelpRequest[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("help_requests")
    .select("*, user:users!help_requests_user_id_fkey(*), claimer:users!help_requests_claimed_by_fkey(*)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getHelpRequestsForAdmin] Error fetching help requests:", error);
    return [];
  }
  return data || [];
}

// Survey queries
export async function getPublishedSurvey(eventId: string): Promise<Survey | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("event_id", eventId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getAllSurveys(eventId: string): Promise<Survey[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

// Intake queries
export async function getAttendeeIntake(
  eventId: string,
  userId: string
): Promise<AttendeeIntake | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendee_intakes")
    .select("*, user:users(*)")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function getEventIntakes(eventId: string): Promise<AttendeeIntake[]> {
  noStore(); // Always fetch fresh data - must sync with checked-in attendees
  const supabase = await createServiceClient();

  // First get all checked-in registrations with user info
  const { data: checkedInRegs, error: checkedInError } = await supabase
    .from("registrations")
    .select("user_id, created_at, user:users(id, name, email, role, created_at)")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null)
    .order("created_at", { ascending: false });

  if (checkedInError) {
    console.error("[getEventIntakes] Error loading checked-in registrations:", checkedInError);
    return [];
  }

  const checkedInUsers = (checkedInRegs || [])
    .map((reg) => {
      if (!reg.user_id) return null;
      const user = Array.isArray(reg.user) ? reg.user[0] : reg.user;
      if (user && typeof user === "object") {
        return {
          user_id: String(reg.user_id),
          created_at: String(reg.created_at),
          user: {
            id: String(user.id),
            name: String(user.name),
            email: user.email ? String(user.email) : null,
            role: user.role as UserRole,
            created_at: user.created_at ? String(user.created_at) : "",
          },
        };
      }
      return {
        user_id: String(reg.user_id),
        created_at: String(reg.created_at),
        user: {
          id: String(reg.user_id),
          name: "Unknown Attendee",
          email: null,
          role: "attendee" as UserRole,
          created_at: "",
        },
      };
    })
    .filter((reg) => reg !== null);

  if (checkedInUsers.length === 0) {
    return [];
  }

  const checkedInUserIds = checkedInUsers.map((reg) => reg.user_id);

  // Then get intakes for those users (include skipped and missing)
  const { data, error } = await supabase
    .from("attendee_intakes")
    .select("*")
    .eq("event_id", eventId)
    .in("user_id", checkedInUserIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEventIntakes] Error:", error);
  }

  const intakeByUserId = new Map<string, AttendeeIntake>();
  (data || []).forEach((intake) => {
    intakeByUserId.set(intake.user_id, intake as AttendeeIntake);
  });

  return checkedInUsers.map((reg) => {
    const intake = intakeByUserId.get(reg.user_id);
    if (intake) {
      return {
        ...intake,
        user: reg.user,
      };
    }
    return {
      id: `missing-${reg.user_id}`,
      event_id: eventId,
      user_id: reg.user_id,
      goals: [],
      goals_other: null,
      offers: [],
      offers_other: null,
      skipped: true,
      created_at: reg.created_at,
      user: reg.user,
    };
  });
}

// Group queries
export async function getSuggestedGroups(eventId: string): Promise<SuggestedGroup[]> {
  noStore(); // Always fetch fresh data - must sync with checked-in attendees
  // Use service client to bypass RLS since groups are created by service client
  const supabase = await createServiceClient();
  console.log("[getSuggestedGroups] Fetching groups for event:", eventId);

  const { data: checkedInRegs } = await supabase
    .from("registrations")
    .select("user_id")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null);

  const checkedInUserIds = new Set((checkedInRegs || []).map((reg) => reg.user_id));
  
  // Note: suggested_group_members has user_id FK to users, but NOT to attendee_intakes
  // So we only join users here
  const { data, error } = await supabase
    .from("suggested_groups")
    .select(`
      *,
      members:suggested_group_members(
        *,
        user:users(*)
      )
    `)
    .eq("event_id", eventId)
    .order("match_score", { ascending: false, nullsFirst: false })
    .order("table_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getSuggestedGroups] Error fetching groups:", error);
    return [];
  }
  
  const filteredGroups = (data || [])
    .map((group: SuggestedGroup) => ({
      ...group,
      members: (group.members || []).filter((member) =>
        checkedInUserIds.has(member.user_id)
      ),
    }))
    .filter((group: SuggestedGroup) => (group.members || []).length > 0);

  console.log("[getSuggestedGroups] Found groups:", filteredGroups.length || 0);
  return filteredGroups;
}

// Seating QR queries
export async function getTableQRCodes(eventId: string): Promise<TableQRCode[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("table_qr_codes")
    .select("*")
    .eq("event_id", eventId)
    .order("table_number", { ascending: true });

  if (error) {
    console.error("[getTableQRCodes] Error:", error);
    return [];
  }
  return data || [];
}

export async function getTableRegistration(
  eventId: string,
  userId: string
): Promise<TableRegistration | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("table_registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getTableRegistration] Error:", error);
    return null;
  }
  return data || null;
}

export async function getTableRegistrations(
  eventId: string
): Promise<TableRegistration[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("table_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });

  if (error) {
    console.error("[getTableRegistrations] Error:", error);
    return [];
  }
  return data || [];
}

// Slide deck queries
export async function getSlideDeck(eventId: string): Promise<SlideDeck | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slide_decks")
    .select("*")
    .eq("event_id", eventId)
    .single();

  if (error) return null;
  return data;
}

// Display page data
export async function getDisplayPageData(eventId: string): Promise<DisplayPageData | null> {
  const supabase = await createClient();
  const now = new Date();

  const [eventResult, agendaResult, questionsResult, announcementsResult, deckResult] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("agenda_items").select("*").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("questions")
      .select("*, user:users(name)")
      .eq("event_id", eventId)
      .in("status", ["open", "pinned"])
      .order("upvotes", { ascending: false })
      .limit(10),
    supabase
      .from("announcements")
      .select("*")
      .eq("event_id", eventId)
      .not("published_at", "is", null)
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`) // Only get announcements that haven't expired
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("slide_decks")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_live", true)
      .single(),
  ]);

  if (eventResult.error || !eventResult.data) return null;

  const agendaItems = agendaResult.data || [];

  // Find current and next sessions
  let currentSession: AgendaItem | null = null;
  let nextSession: AgendaItem | null = null;

  for (const item of agendaItems) {
    if (item.start_time && item.end_time) {
      const start = new Date(item.start_time);
      const end = new Date(item.end_time);

      if (now >= start && now <= end) {
        currentSession = item;
      } else if (now < start && !nextSession) {
        nextSession = item;
      }
    }
  }

  return {
    event: eventResult.data,
    currentSession,
    nextSession,
    recentQuestions: questionsResult.data || [],
    announcements: announcementsResult.data || [],
    slideDeck: deckResult.data || null,
  };
}

// Poll queries
export async function getActivePolls(eventId: string): Promise<Poll[]> {
  const supabase = await createClient();
  
  // First, deactivate any expired polls
  const { deactivateExpiredPolls } = await import("@/lib/actions/polls");
  await deactivateExpiredPolls(eventId);
  
  const now = new Date().toISOString();
  // Query active polls that either have no end time or haven't ended yet
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .or(`ends_at.is.null,ends_at.gt."${now}"`) // Only include polls that haven't ended
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getAllPolls(eventId: string): Promise<Poll[]> {
  const supabase = await createClient();
  
  // First, deactivate any expired polls
  const { deactivateExpiredPolls } = await import("@/lib/actions/polls");
  await deactivateExpiredPolls(eventId);
  
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getPollWithVotes(
  pollId: string,
  userId?: string
): Promise<PollWithVotes | null> {
  const supabase = await createClient();

  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("*")
    .eq("id", pollId)
    .single();

  if (pollError || !poll) return null;

  const { data: votes } = await supabase
    .from("poll_votes")
    .select("*")
    .eq("poll_id", pollId);

  const allVotes = votes || [];
  const userVote = userId
    ? allVotes.find((v) => v.user_id === userId) || null
    : null;

  // Calculate vote counts for each option
  const optionsArray = poll.options as string[];
  const voteCounts = optionsArray.map(
    (_, index) => allVotes.filter((v) => v.option_index === index).length
  );

  return {
    ...poll,
    votes: allVotes,
    user_vote: userVote,
    vote_counts: voteCounts,
    total_votes: allVotes.length,
  };
}

export async function getActivePollsWithVotes(
  eventId: string,
  userId?: string
): Promise<PollWithVotes[]> {
  const supabase = await createClient();

  // First, deactivate any expired polls
  const { deactivateExpiredPolls } = await import("@/lib/actions/polls");
  await deactivateExpiredPolls(eventId);

  const now = new Date().toISOString();
  // Query active polls that either have no end time or haven't ended yet
  const { data: polls, error } = await supabase
    .from("polls")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .or(`ends_at.is.null,ends_at.gt."${now}"`) // Only include polls that haven't ended
    .order("created_at", { ascending: false });

  if (error || !polls) return [];

  const pollsWithVotes = await Promise.all(
    polls.map(async (poll) => {
      const { data: votes } = await supabase
        .from("poll_votes")
        .select("*")
        .eq("poll_id", poll.id);

      const allVotes = votes || [];
      const userVote = userId
        ? allVotes.find((v) => v.user_id === userId) || null
        : null;

      const optionsArray = poll.options as string[];
      const voteCounts = optionsArray.map(
        (_, index) => allVotes.filter((v) => v.option_index === index).length
      );

      return {
        ...poll,
        votes: allVotes,
        user_vote: userVote,
        vote_counts: voteCounts,
        total_votes: allVotes.length,
      };
    })
  );

  return pollsWithVotes;
}

// Analytics queries
export interface CheckInDataPoint {
  time: string; // ISO timestamp
  count: number;
  cumulative: number;
}

export interface QAAnalytics {
  mostUpvoted: Question[];
  unansweredAging: Array<{
    question: Question;
    ageMinutes: number;
  }>;
}

export interface PollParticipation {
  pollId: string;
  pollTitle: string;
  totalVotes: number;
  participationRate: number; // percentage of checked-in attendees
  checkedInCount: number;
}

export interface IntakeAnalytics {
  completionRate: number; // percentage
  dropOffRate: number; // percentage
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

export async function getSeriesAttendanceData(seriesId: string): Promise<SeriesAttendanceDataPoint[]> {
  const supabase = await createServiceClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, start_time")
    .eq("series_id", seriesId)
    .order("start_time", { ascending: true });

  if (error || !events || events.length === 0) {
    if (error) {
      console.error("[getSeriesAttendanceData] Error fetching events:", error);
    }
    return [];
  }

  const eventIds = events.map((event) => event.id);
  const { data: registrations, error: regError } = await supabase
    .from("registrations")
    .select("event_id, checked_in_at")
    .in("event_id", eventIds);

  if (regError) {
    console.error("[getSeriesAttendanceData] Error fetching registrations:", regError);
  }

  const counts = new Map<string, { registered: number; checked_in: number }>();
  eventIds.forEach((id) => counts.set(id, { registered: 0, checked_in: 0 }));

  (registrations || []).forEach((reg) => {
    const current = counts.get(reg.event_id) || { registered: 0, checked_in: 0 };
    current.registered += 1;
    if (reg.checked_in_at) {
      current.checked_in += 1;
    }
    counts.set(reg.event_id, current);
  });

  return events.map((event) => {
    const count = counts.get(event.id) || { registered: 0, checked_in: 0 };
    return {
      name: event.name,
      start_time: event.start_time,
      registered: count.registered,
      checked_in: count.checked_in,
    };
  });
}

export async function getCheckInCurve(eventId: string): Promise<CheckInDataPoint[]> {
  const supabase = await createClient();
  
  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("checked_in_at, created_at")
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null)
    .order("checked_in_at", { ascending: true });

  if (error || !registrations || registrations.length === 0) return [];

  // Group by hour
  const hourlyCounts = new Map<string, number>();
  
  registrations.forEach((reg) => {
    if (!reg.checked_in_at) return;
    const date = new Date(reg.checked_in_at);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const hourKey = `${date.getFullYear()}-${month}-${day}T${hour}:00:00`;
    
    hourlyCounts.set(hourKey, (hourlyCounts.get(hourKey) || 0) + 1);
  });

  // Convert to array, sort by time, and calculate cumulative
  const sortedEntries = Array.from(hourlyCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  
  return sortedEntries.map(([time, count]) => {
    cumulative += count;
    return {
      time,
      count, // Count for this hour
      cumulative, // Total up to this hour
    };
  });
}

export async function getQAAnalytics(eventId: string): Promise<QAAnalytics> {
  const supabase = await createClient();
  
  const { data: questions, error } = await supabase
    .from("questions")
    .select("*, user:users(name)")
    .eq("event_id", eventId)
    .order("upvotes", { ascending: false });

  if (error || !questions) {
    return { mostUpvoted: [], unansweredAging: [] };
  }

  const mostUpvoted = questions.slice(0, 10);
  
  const now = new Date();
  const unansweredAging = questions
    .filter((q) => q.status === "open")
    .map((q) => {
      const created = new Date(q.created_at);
      const ageMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
      return { question: q, ageMinutes };
    })
    .sort((a, b) => b.ageMinutes - a.ageMinutes);

  return { mostUpvoted, unansweredAging };
}

export async function getPollParticipation(eventId: string): Promise<PollParticipation[]> {
  const supabase = await createClient();
  
  // Get all polls
  const { data: polls, error: pollsError } = await supabase
    .from("polls")
    .select("*")
    .eq("event_id", eventId);

  if (pollsError || !polls) return [];

  // Get checked-in count
  const { count: checkedInCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .not("checked_in_at", "is", null);

  const totalCheckedIn = checkedInCount || 0;

  // Get votes for each poll
  const participationData = await Promise.all(
    polls.map(async (poll) => {
      const { count: voteCount } = await supabase
        .from("poll_votes")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", poll.id);

      const totalVotes = voteCount || 0;
      const participationRate = totalCheckedIn > 0 ? (totalVotes / totalCheckedIn) * 100 : 0;

      return {
        pollId: poll.id,
        pollTitle: poll.question,
        totalVotes,
        participationRate,
        checkedInCount: totalCheckedIn,
      };
    })
  );

  return participationData;
}

export async function getIntakeAnalytics(eventId: string): Promise<IntakeAnalytics> {
  const supabase = await createClient();
  
  // Get total registrations
  const { count: totalRegistrations } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const total = totalRegistrations || 0;

  // Get intakes
  const { data: intakes, error } = await supabase
    .from("attendee_intakes")
    .select("id, completed, skipped")
    .eq("event_id", eventId);

  if (error || !intakes) {
    return {
      completionRate: 0,
      dropOffRate: 0,
      started: 0,
      completed: 0,
      skipped: 0,
      total,
    };
  }

  const started = intakes.length;
  const completed = intakes.filter((i) => i.completed).length;
  const skipped = intakes.filter((i) => i.skipped).length;
  const notStarted = total - started;

  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  const dropOffRate = started > 0 ? ((started - completed - skipped) / started) * 100 : 0;

  return {
    completionRate,
    dropOffRate,
    started,
    completed,
    skipped,
    total,
  };
}

// Competition queries
export async function getActiveCompetitions(eventId: string): Promise<CompetitionWithEntries[]> {
  console.log("[getActiveCompetitions] Fetching for eventId:", eventId);
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("*, entries:competition_entries!competition_entries_competition_id_fkey(*, user:users(id, name, email))")
    .eq("event_id", eventId)
    .in("status", ["active", "voting", "ended"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActiveCompetitions] Error:", error);
    return [];
  }
  // Load vote counts for each entry
  if (data?.length) {
    for (const comp of data) {
      if (comp.entries?.length) {
        const { data: votes } = await supabase
          .from("competition_votes")
          .select("*")
          .eq("competition_id", comp.id);
        const allVotes = votes || [];
        for (const entry of comp.entries) {
          const entryVotes = allVotes.filter((v: { entry_id: string }) => v.entry_id === entry.id);
          entry.vote_count = entryVotes.length;
          entry.avg_score =
            entryVotes.length > 0
              ? entryVotes.reduce((sum: number, v: { score: number }) => sum + v.score, 0) / entryVotes.length
              : 0;
        }
        if (comp.winner_entry_id) {
          comp.winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.winner_entry_id) || null;
        }
        if (comp.group_winner_entry_id) {
          comp.group_winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.group_winner_entry_id) || null;
        }
        if (comp.admin_winner_entry_id) {
          comp.admin_winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.admin_winner_entry_id) || null;
        }
      }
    }
  }
  console.log("[getActiveCompetitions] Found", data?.length || 0, "active competitions");
  return data || [];
}

export async function getAllCompetitions(eventId: string): Promise<CompetitionWithEntries[]> {
  console.log("[getAllCompetitions] Fetching for eventId:", eventId);
  
  try {
    const supabase = await createServiceClient();
    
    // First, try simple query without joins to verify table access
    const { data: simpleData, error: simpleError } = await supabase
      .from("competitions")
      .select("*")
      .eq("event_id", eventId);
    
    console.log("[getAllCompetitions] Simple query result:", { 
      count: simpleData?.length || 0, 
      error: simpleError?.message || null,
      data: simpleData 
    });
    
    if (simpleError) {
      console.error("[getAllCompetitions] Simple query error:", simpleError);
      return [];
    }
    
    // If no competitions, return empty
    if (!simpleData || simpleData.length === 0) {
      console.log("[getAllCompetitions] No competitions found for this event");
      return [];
    }
    
    // Now try with entries join
    const { data, error } = await supabase
      .from("competitions")
      .select("*, entries:competition_entries!competition_entries_competition_id_fkey(*, user:users(id, name, email))")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getAllCompetitions] Full query error:", error);
      // Fallback to simple data with empty entries
      return simpleData.map(c => ({ ...c, entries: [] })) as CompetitionWithEntries[];
    }
    
    // Load vote counts for each entry
    if (data?.length) {
      for (const comp of data) {
        if (comp.entries?.length) {
          const { data: votes } = await supabase
            .from("competition_votes")
            .select("*")
            .eq("competition_id", comp.id);
          const allVotes = votes || [];
          for (const entry of comp.entries) {
            const entryVotes = allVotes.filter((v: { entry_id: string }) => v.entry_id === entry.id);
            entry.vote_count = entryVotes.length;
            entry.avg_score =
              entryVotes.length > 0
                ? entryVotes.reduce((sum: number, v: { score: number }) => sum + v.score, 0) / entryVotes.length
                : 0;
          }
          if (comp.winner_entry_id) {
            comp.winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.winner_entry_id) || null;
          }
          if (comp.group_winner_entry_id) {
            comp.group_winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.group_winner_entry_id) || null;
          }
          if (comp.admin_winner_entry_id) {
            comp.admin_winner_entry = comp.entries.find((e: { id: string }) => e.id === comp.admin_winner_entry_id) || null;
          }
        }
      }
    }

    console.log("[getAllCompetitions] Found", data?.length || 0, "competitions with entries");
    return data || [];
  } catch (err) {
    console.error("[getAllCompetitions] Exception:", err);
    return [];
  }
}

export async function getCompetitionWithEntries(
  competitionId: string,
  userId?: string
): Promise<CompetitionWithEntries | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("*, entries:competition_entries!competition_entries_competition_id_fkey(*, user:users(id, name, email))")
    .eq("id", competitionId)
    .single();

  if (error) {
    console.error("[getCompetitionWithEntries] Error:", error);
    return null;
  }

  // Load votes for each entry
  if (data?.entries) {
    const { data: votes } = await supabase
      .from("competition_votes")
      .select("*")
      .eq("competition_id", competitionId);

    const allVotes = votes || [];
    for (const entry of data.entries) {
      const entryVotes = allVotes.filter((v) => v.entry_id === entry.id);
      entry.vote_count = entryVotes.length;
      entry.avg_score =
        entryVotes.length > 0
          ? entryVotes.reduce((sum, v) => sum + v.score, 0) / entryVotes.length
          : 0;
    }

    // Resolve winner entry
    if (data.winner_entry_id) {
      data.winner_entry = data.entries.find((e: CompetitionEntry) => e.id === data.winner_entry_id) || null;
    }
  }

  return data;
}

// ─── Conversation Themes ──────────────────────────────────────────────────────

export async function getConversationThemes(): Promise<ConversationTheme[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversation_themes")
    .select("*")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as ConversationTheme[];
}

export async function getEventThemeSelection(eventId: string): Promise<EventThemeSelection | null> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_theme_selections")
    .select("*, theme:conversation_themes(*)")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return null;
  return data as EventThemeSelection | null;
}

// ─── Planned Events (Planning Calendar) ──────────────────────────────────────

export async function getPlannedEvents(): Promise<PlannedEvent[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planned_events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) return [];
  return (data ?? []) as PlannedEvent[];
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function getVenues(): Promise<Venue[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as Venue[];
}

// ─── Calendar Cities ──────────────────────────────────────────────────────────

export async function getEventCalendarCities(): Promise<EventCalendarCity[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_calendar_cities")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as EventCalendarCity[];
}

// ─── Cursor Credits ───────────────────────────────────────────────────────────

import type { CursorCredit } from "@/types";

export async function getCursorCredits(eventId: string): Promise<CursorCredit[]> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("cursor_credits")
    .select("*, user:users(name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as CursorCredit[];
}

export async function getCursorCredit(
  eventId: string,
  userId: string
): Promise<CursorCredit | null> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("cursor_credits")
    .select("*")
    .eq("event_id", eventId)
    .eq("assigned_to", userId)
    .maybeSingle();
  if (error) return null;
  return data as CursorCredit | null;
}

// ── Speed Networking queries ──────────────────────────────────────────────────

import type {
  SpeedNetworkingSession,
  SpeedNetworkingRound,
  SpeedNetworkingPair,
} from "@/types";

export async function getNetworkingSession(
  eventId: string
): Promise<SpeedNetworkingSession | null> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("speed_networking_sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as SpeedNetworkingSession | null;
}

export async function getNetworkingCurrentRound(
  sessionId: string
): Promise<SpeedNetworkingRound | null> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("speed_networking_rounds")
    .select("*")
    .eq("session_id", sessionId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as SpeedNetworkingRound | null;
}

export async function getNetworkingPairsForRound(
  roundId: string
): Promise<SpeedNetworkingPair[]> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("speed_networking_pairs")
    .select("*, user1:users!speed_networking_pairs_user1_id_fkey(id, name), user2:users!speed_networking_pairs_user2_id_fkey(id, name)")
    .eq("round_id", roundId)
    .order("color_code");
  if (error) return [];
  return (data ?? []) as SpeedNetworkingPair[];
}

export async function getUserNetworkingPair(
  roundId: string,
  userId: string
): Promise<SpeedNetworkingPair | null> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("speed_networking_pairs")
    .select("*, user1:users!speed_networking_pairs_user1_id_fkey(id, name), user2:users!speed_networking_pairs_user2_id_fkey(id, name)")
    .eq("round_id", roundId)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .maybeSingle();
  if (error) return null;
  return data as SpeedNetworkingPair | null;
}

// ─── Exchange Board ───────────────────────────────────────────────────────────

import type { ExchangePost } from "@/types";

export async function getExchangePosts(eventId: string): Promise<ExchangePost[]> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("exchange_posts")
    .select("*, user:users!exchange_posts_user_id_fkey(id, name), matched_user:users!exchange_posts_matched_with_fkey(id, name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getExchangePosts] Error:", error);
    return [];
  }
  return (data ?? []) as ExchangePost[];
}

export async function getOpenExchangePosts(eventId: string): Promise<ExchangePost[]> {
  noStore();
  const supabase = await createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("exchange_posts")
    .select("*, user:users!exchange_posts_user_id_fkey(id, name), matched_user:users!exchange_posts_matched_with_fkey(id, name)")
    .eq("event_id", eventId)
    .eq("status", "open")
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getOpenExchangePosts] Error:", error);
    return [];
  }
  return (data ?? []) as ExchangePost[];
}

// ─── Event Photos ─────────────────────────────────────────────────────────────

export async function getEventPhotosForAdmin(eventId: string, status?: PhotoStatus): Promise<EventPhoto[]> {
  noStore();
  const supabase = await createServiceClient();

  let query = supabase
    .from("event_photos")
    .select("*, uploader:users!event_photos_uploaded_by_fkey(id, name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getEventPhotosForAdmin] Error:", error);
    return [];
  }
  return (data ?? []) as EventPhoto[];
}

export async function getApprovedEventPhotos(eventId: string): Promise<EventPhoto[]> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("event_photos")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getApprovedEventPhotos] Error:", error);
    return [];
  }
  return (data ?? []) as EventPhoto[];
}

export async function getPendingPhotoCount(eventId: string): Promise<number> {
  noStore();
  const supabase = await createServiceClient();
  const { count, error } = await supabase
    .from("event_photos")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "pending");

  if (error) {
    console.error("[getPendingPhotoCount] Error:", error);
    return 0;
  }
  return count ?? 0;
}

export async function getUserEventPhotos(eventId: string, userId: string): Promise<EventPhoto[]> {
  noStore();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("event_photos")
    .select("*")
    .eq("event_id", eventId)
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getUserEventPhotos] Error:", error);
    return [];
  }
  return (data ?? []) as EventPhoto[];
}

export interface EventWithPhotos {
  id: string;
  slug: string;
  name: string;
  start_time: string | null;
  status: string;
  venue: string | null;
  photos: EventPhoto[];
}

export async function getEventsWithApprovedPhotos(): Promise<EventWithPhotos[]> {
  noStore();
  const supabase = await createServiceClient();

  const { data: photos, error: photosError } = await supabase
    .from("event_photos")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (photosError || !photos || photos.length === 0) {
    return [];
  }

  const eventIds = [...new Set(photos.map((p) => p.event_id))];

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, slug, name, start_time, status, venue")
    .in("id", eventIds)
    .order("start_time", { ascending: false });

  if (eventsError || !events) {
    return [];
  }

  return events.map((ev: any) => ({
    id: ev.id,
    slug: ev.slug,
    name: ev.name,
    start_time: ev.start_time,
    status: ev.status,
    venue: ev.venue,
    photos: photos.filter((p) => p.event_id === ev.id) as EventPhoto[],
  }));
}

export async function getHeroFeaturedPhotoIds(): Promise<string[]> {
  noStore();
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "hero_featured_photo_ids")
    .single();

  if (!data?.value) return [];
  try {
    return JSON.parse(data.value);
  } catch {
    return [];
  }
}
