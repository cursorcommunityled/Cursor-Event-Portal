import type {
  Event,
  User,
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
  Poll,
  PollVote,
  PollWithVotes,
  SlideDeck,
  Competition,
  CompetitionEntry,
  CompetitionWithEntries,
  ConversationTheme,
  EventThemeSelection,
  PlannedEvent,
  EventCalendarCity,
  Venue,
  ExchangePost,
  CursorCredit,
  SpeedNetworkingSession,
  TableQRCode,
  TableRegistration,
} from "@/types";

// ─── Event ────────────────────────────────────────────────────────────────────

export const MOCK_EVENT: Event = {
  id: "evt-001",
  slug: "calgary-feb-2026",
  code: "CPY26",
  name: "Cursor Popup Calgary — February 2026",
  venue: "Platform Calgary",
  address: "255 5 Ave SW, Calgary, AB T2P 3G6",
  capacity: 80,
  start_time: "2026-02-18T18:00:00-07:00",
  end_time: "2026-02-18T22:00:00-07:00",
  status: "active",
  seat_lockout_active: false,
  smart_seating_active: false,
  seating_enabled: true,
  survey_popup_visible: false,
  timezone: "America/Edmonton",
  admin_code: "feb2026",
  data_retention_days: 90,
  venue_image_url: null,
  timer_label: "Hacking ends in",
  timer_end_time: "2026-02-18T21:00:00-07:00",
  timer_active: true,
  series_id: "series-001",
  created_at: "2026-01-15T10:00:00Z",
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  {
    id: "usr-001",
    email: "alex.chen@example.com",
    name: "Alex Chen",
    role: "attendee",
    goals: ["learn-ai", "networking"],
    offers: ["software-dev", "ai-expertise"],
    role_category: "founder",
    founder_stage: "pre-seed",
    linkedin: "https://linkedin.com/in/alexchen",
    cursor_experience: "active",
    created_at: "2026-02-10T08:00:00Z",
  },
  {
    id: "usr-002",
    email: "sarah.moore@example.com",
    name: "Sarah Moore",
    role: "attendee",
    goals: ["networking", "find-cofounders"],
    offers: ["design", "business-strategy"],
    role_category: "professional",
    years_experience: 5,
    cursor_experience: "trialed",
    created_at: "2026-02-11T09:30:00Z",
  },
  {
    id: "usr-003",
    email: "james.patel@example.com",
    name: "James Patel",
    role: "attendee",
    goals: ["learn-coding", "explore-tools"],
    offers: ["mentorship", "funding-investment"],
    role_category: "founder",
    founder_stage: "seed",
    cursor_experience: "power",
    created_at: "2026-02-12T11:00:00Z",
  },
  {
    id: "usr-004",
    email: "emily.nguyen@example.com",
    name: "Emily Nguyen",
    role: "attendee",
    goals: ["find-job", "networking"],
    offers: ["software-dev", "ai-expertise"],
    role_category: "student",
    degree_type: "bachelors",
    cursor_experience: "curious",
    created_at: "2026-02-13T14:00:00Z",
  },
  {
    id: "usr-005",
    email: "mike.larson@example.com",
    name: "Mike Larson",
    role: "attendee",
    goals: ["hire-talent", "networking"],
    offers: ["business-strategy", "mentorship"],
    role_category: "professional",
    years_experience: 10,
    cursor_experience: "active",
    created_at: "2026-02-14T10:00:00Z",
  },
  {
    id: "usr-006",
    email: "priya.sharma@example.com",
    name: "Priya Sharma",
    role: "attendee",
    goals: ["learn-ai", "explore-tools"],
    offers: ["ai-expertise", "collaboration"],
    role_category: "founder",
    founder_stage: "bootstrapped",
    cursor_experience: "power",
    created_at: "2026-02-14T15:00:00Z",
  },
  {
    id: "usr-007",
    email: "david.kim@example.com",
    name: "David Kim",
    role: "attendee",
    goals: ["networking", "find-cofounders"],
    offers: ["software-dev", "collaboration"],
    role_category: "student",
    degree_type: "masters",
    cursor_experience: "trialed",
    created_at: "2026-02-15T09:00:00Z",
  },
  {
    id: "usr-008",
    email: "rachel.wolfe@example.com",
    name: "Rachel Wolfe",
    role: "staff",
    goals: [],
    offers: [],
    cursor_experience: "active",
    created_at: "2026-01-01T00:00:00Z",
  },
];

// ─── Registrations ────────────────────────────────────────────────────────────

export const MOCK_REGISTRATIONS: Registration[] = MOCK_USERS.map((user, i) => ({
  id: `reg-00${i + 1}`,
  event_id: MOCK_EVENT.id,
  user_id: user.id,
  consent_at: new Date(Date.now() - (7 - i) * 86400000).toISOString(),
  survey_consent_at: i < 5 ? new Date(Date.now() - (7 - i) * 86400000).toISOString() : null,
  source: (["qr", "link", "walk-in", "qr", "link", "qr", "link", "walk-in"] as const)[i],
  checked_in_at: i < 6 ? new Date(Date.now() - 3600000 + i * 300000).toISOString() : null,
  intake_completed_at: i < 5 ? new Date(Date.now() - 3400000 + i * 300000).toISOString() : null,
  created_at: user.created_at,
  user,
}));

// ─── Agenda ───────────────────────────────────────────────────────────────────

export const MOCK_AGENDA: AgendaItem[] = [
  {
    id: "agi-001",
    event_id: MOCK_EVENT.id,
    title: "Doors Open & Networking",
    description: "Grab a drink, meet the other builders, and settle in.",
    location: "Main Hall",
    speaker: null,
    start_time: "2026-02-18T18:00:00-07:00",
    end_time: "2026-02-18T18:30:00-07:00",
    sort_order: 1,
    image_url: null,
    created_at: "2026-01-20T10:00:00Z",
  },
  {
    id: "agi-002",
    event_id: MOCK_EVENT.id,
    title: "Welcome & Intros",
    description: "Quick overview of tonight's format and goals.",
    location: "Main Stage",
    speaker: "Rachel Wolfe",
    start_time: "2026-02-18T18:30:00-07:00",
    end_time: "2026-02-18T18:45:00-07:00",
    sort_order: 2,
    image_url: null,
    created_at: "2026-01-20T10:00:00Z",
  },
  {
    id: "agi-003",
    event_id: MOCK_EVENT.id,
    title: "Lightning Talk: Ship Faster with Cursor",
    description: "How top builders are using AI to cut dev cycles in half.",
    location: "Main Stage",
    speaker: "James Patel",
    start_time: "2026-02-18T18:45:00-07:00",
    end_time: "2026-02-18T19:15:00-07:00",
    sort_order: 3,
    image_url: null,
    created_at: "2026-01-20T10:00:00Z",
  },
  {
    id: "agi-004",
    event_id: MOCK_EVENT.id,
    title: "Hacking Session",
    description: "2 hours to build something cool. Tables have themes to inspire you.",
    location: "All Tables",
    speaker: null,
    start_time: "2026-02-18T19:15:00-07:00",
    end_time: "2026-02-18T21:00:00-07:00",
    sort_order: 4,
    image_url: null,
    created_at: "2026-01-20T10:00:00Z",
  },
  {
    id: "agi-005",
    event_id: MOCK_EVENT.id,
    title: "Demo Time",
    description: "Show the room what you built. 2 minutes per project.",
    location: "Main Stage",
    speaker: null,
    start_time: "2026-02-18T21:00:00-07:00",
    end_time: "2026-02-18T21:45:00-07:00",
    sort_order: 5,
    image_url: null,
    created_at: "2026-01-20T10:00:00Z",
  },
  {
    id: "agi-006",
    event_id: MOCK_EVENT.id,
    title: "Prizes & Wrap-up",
    description: "Awards, shoutouts, and what's next for the community.",
    location: "Main Stage",
    speaker: "Rachel Wolfe",
    start_time: "2026-02-18T21:45:00-07:00",
    end_time: "2026-02-18T22:00:00-07:00",
    sort_order: 6,
    image_url: null,
    created_at: "2026-01-20T10:00:00Z",
  },
];

// ─── Announcements ────────────────────────────────────────────────────────────

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-001",
    event_id: MOCK_EVENT.id,
    content: "WiFi password: CursorPopup2026",
    priority: 1,
    published_at: new Date(Date.now() - 3600000).toISOString(),
    expires_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "ann-002",
    event_id: MOCK_EVENT.id,
    content: "Demos start at 9pm! Make sure you sign up at the front if you want to present.",
    priority: 2,
    published_at: new Date(Date.now() - 1800000).toISOString(),
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

// ─── Questions ────────────────────────────────────────────────────────────────

const MOCK_ANSWERS: Answer[] = [
  {
    id: "ans-001",
    question_id: "que-001",
    user_id: "usr-003",
    content: "I've been using the .cursorrules file with context about my tech stack — makes a huge difference. Also, tagging sections of code with comments like // @cursor helps it focus.",
    is_accepted: true,
    created_at: new Date(Date.now() - 900000).toISOString(),
    user: MOCK_USERS[2],
  },
];

export const MOCK_QUESTIONS: Question[] = [
  {
    id: "que-001",
    event_id: MOCK_EVENT.id,
    user_id: "usr-001",
    content: "What's your best tip for getting Cursor to understand a large codebase?",
    tags: ["cursor", "workflow"],
    upvotes: 12,
    status: "answered",
    created_at: new Date(Date.now() - 2400000).toISOString(),
    user: MOCK_USERS[0],
    answers: MOCK_ANSWERS,
    user_has_upvoted: false,
  },
  {
    id: "que-002",
    event_id: MOCK_EVENT.id,
    user_id: "usr-002",
    content: "Has anyone tried using Claude vs GPT-4 as the backend model in Cursor? What do you prefer?",
    tags: ["models", "cursor"],
    upvotes: 8,
    status: "open",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    user: MOCK_USERS[1],
    answers: [],
    user_has_upvoted: false,
  },
  {
    id: "que-003",
    event_id: MOCK_EVENT.id,
    user_id: "usr-004",
    content: "Any recommendations for deploying a Next.js + Supabase app quickly tonight?",
    tags: ["deployment", "nextjs"],
    upvotes: 6,
    status: "open",
    created_at: new Date(Date.now() - 1200000).toISOString(),
    user: MOCK_USERS[3],
    answers: [],
    user_has_upvoted: false,
  },
  {
    id: "que-004",
    event_id: MOCK_EVENT.id,
    user_id: "usr-005",
    content: "Is anyone building anything with real-time voice APIs tonight?",
    tags: ["voice", "ai"],
    upvotes: 4,
    status: "pinned",
    created_at: new Date(Date.now() - 600000).toISOString(),
    user: MOCK_USERS[4],
    answers: [],
    user_has_upvoted: false,
  },
];

// ─── Help Requests ────────────────────────────────────────────────────────────

export const MOCK_HELP_REQUESTS: HelpRequest[] = [
  {
    id: "hlp-001",
    event_id: MOCK_EVENT.id,
    user_id: "usr-004",
    category: "Debugging",
    description: "My Supabase auth isn't persisting cookies in Next.js 14 — keeps logging me out.",
    status: "helping",
    claimed_by: "usr-008",
    created_at: new Date(Date.now() - 1500000).toISOString(),
    resolved_at: null,
    user: MOCK_USERS[3],
    claimer: MOCK_USERS[7],
  },
  {
    id: "hlp-002",
    event_id: MOCK_EVENT.id,
    user_id: "usr-007",
    category: "Cursor",
    description: "Cursor keeps overwriting my tailwind classes when I ask it to add a new component.",
    status: "waiting",
    claimed_by: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
    resolved_at: null,
    user: MOCK_USERS[6],
    claimer: undefined,
  },
  {
    id: "hlp-003",
    event_id: MOCK_EVENT.id,
    user_id: "usr-001",
    category: "Deployment",
    description: "Render cold starts are killing my demo — any quick fixes?",
    status: "resolved",
    claimed_by: "usr-003",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    resolved_at: new Date(Date.now() - 2400000).toISOString(),
    user: MOCK_USERS[0],
    claimer: MOCK_USERS[2],
  },
];

// ─── Polls ────────────────────────────────────────────────────────────────────

export const MOCK_POLLS_WITH_VOTES: PollWithVotes[] = [
  {
    id: "pol-001",
    event_id: MOCK_EVENT.id,
    question: "What's your primary AI coding tool right now?",
    options: ["Cursor", "GitHub Copilot", "Claude/ChatGPT directly", "I don't use AI yet"],
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    is_active: true,
    show_results: true,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    votes: [],
    user_vote: null,
    vote_counts: [34, 12, 8, 2],
    total_votes: 56,
  },
  {
    id: "pol-002",
    event_id: MOCK_EVENT.id,
    question: "How long have you been coding?",
    options: ["< 1 year", "1–3 years", "3–7 years", "7+ years"],
    ends_at: new Date(Date.now() + 7200000).toISOString(),
    is_active: true,
    show_results: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    votes: [],
    user_vote: null,
    vote_counts: [5, 18, 22, 15],
    total_votes: 60,
  },
];

// ─── Surveys ──────────────────────────────────────────────────────────────────

export const MOCK_SURVEY: Survey = {
  id: "srv-001",
  event_id: MOCK_EVENT.id,
  title: "Event Feedback",
  schema: {
    fields: [
      { id: "f1", type: "nps", label: "How likely are you to recommend Cursor Popup to a friend?", required: true },
      { id: "f2", type: "rating", label: "How was the quality of the hacking session?", required: true },
      { id: "f3", type: "select", label: "What was the best part of tonight?", required: false, options: ["Networking", "The talk", "Hacking session", "Demos", "Prizes"] },
      { id: "f4", type: "textarea", label: "Any other feedback?", required: false },
    ],
  },
  published_at: new Date(Date.now() - 7200000).toISOString(),
  created_at: new Date(Date.now() - 86400000).toISOString(),
};

// ─── Intakes ──────────────────────────────────────────────────────────────────

export const MOCK_INTAKES: AttendeeIntake[] = MOCK_USERS.slice(0, 5).map((user, i) => ({
  id: `itk-00${i + 1}`,
  event_id: MOCK_EVENT.id,
  user_id: user.id,
  goals: user.goals || [],
  goals_other: null,
  offers: user.offers || [],
  offers_other: null,
  role_category: user.role_category || null,
  founder_stage: user.founder_stage || null,
  years_experience: user.years_experience || null,
  degree_type: user.degree_type || null,
  linkedin: user.linkedin || null,
  github: null,
  website: null,
  intent: "Build something cool and meet other builders in Calgary.",
  followup_consent: true,
  cursor_experience: user.cursor_experience || null,
  skipped: false,
  created_at: user.created_at,
  user,
}));

// ─── Suggested Groups ─────────────────────────────────────────────────────────

export const MOCK_GROUPS: SuggestedGroup[] = [
  {
    id: "grp-001",
    event_id: MOCK_EVENT.id,
    name: "AI-Powered SaaS",
    description: "Founders and builders focused on AI-native products",
    status: "approved",
    table_number: 3,
    match_score: 94,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    members: [
      { id: "m1", group_id: "grp-001", user_id: "usr-001", match_reason: "Founder building AI SaaS", created_at: "", user: MOCK_USERS[0], intake: MOCK_INTAKES[0] },
      { id: "m2", group_id: "grp-001", user_id: "usr-003", match_reason: "Seed-stage, strong AI background", created_at: "", user: MOCK_USERS[2], intake: MOCK_INTAKES[2] },
      { id: "m3", group_id: "grp-001", user_id: "usr-006", match_reason: "Bootstrapped AI founder", created_at: "", user: MOCK_USERS[5], intake: MOCK_INTAKES[4] },
    ],
  },
  {
    id: "grp-002",
    event_id: MOCK_EVENT.id,
    name: "Design × Code",
    description: "Builders who care about UX as much as engineering",
    status: "approved",
    table_number: 5,
    match_score: 88,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    members: [
      { id: "m4", group_id: "grp-002", user_id: "usr-002", match_reason: "UX + business strategy background", created_at: "", user: MOCK_USERS[1], intake: MOCK_INTAKES[1] },
      { id: "m5", group_id: "grp-002", user_id: "usr-004", match_reason: "Looking for design mentorship", created_at: "", user: MOCK_USERS[3], intake: MOCK_INTAKES[3] },
      { id: "m6", group_id: "grp-002", user_id: "usr-007", match_reason: "Masters student, frontend-focused", created_at: "", user: MOCK_USERS[6] },
    ],
  },
];

// ─── Competitions ─────────────────────────────────────────────────────────────

const MOCK_ENTRIES: CompetitionEntry[] = [
  {
    id: "ent-001",
    competition_id: "cmp-001",
    user_id: "usr-001",
    title: "InstaRefactor",
    description: "Paste any legacy codebase and get a full refactor plan with Cursor in under 60 seconds.",
    repo_url: "https://github.com/example/instarefactor",
    project_url: "https://instarefactor.demo",
    preview_image_url: null,
    video_url: null,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    user: MOCK_USERS[0],
    vote_count: 18,
    avg_score: 4.4,
  },
  {
    id: "ent-002",
    competition_id: "cmp-001",
    user_id: "usr-006",
    title: "PitchBot",
    description: "AI co-pilot that helps founders rehearse their investor pitch and gives real-time feedback.",
    repo_url: "https://github.com/example/pitchbot",
    project_url: "https://pitchbot.demo",
    preview_image_url: null,
    video_url: null,
    created_at: new Date(Date.now() - 2100000).toISOString(),
    user: MOCK_USERS[5],
    vote_count: 15,
    avg_score: 4.1,
  },
  {
    id: "ent-003",
    competition_id: "cmp-001",
    user_id: "usr-003",
    title: "DealFlow Tracker",
    description: "A Notion-like CRM for angel investors, built entirely with Cursor in 90 minutes.",
    repo_url: "https://github.com/example/dealflow",
    project_url: null,
    preview_image_url: null,
    video_url: null,
    created_at: new Date(Date.now() - 1500000).toISOString(),
    user: MOCK_USERS[2],
    vote_count: 12,
    avg_score: 3.9,
  },
];

export const MOCK_COMPETITIONS: CompetitionWithEntries[] = [
  {
    id: "cmp-001",
    event_id: MOCK_EVENT.id,
    title: "Best Build of the Night",
    description: "Most impressive project built (or significantly advanced) during tonight's hacking session.",
    rules: "Must use Cursor. Must be demoed live. 2 minutes max.",
    status: "voting",
    voting_mode: "top3",
    winner_entry_id: null,
    winner_method: null,
    top3_entry_ids: ["ent-001", "ent-002", "ent-003"],
    group_winner_entry_id: "ent-001",
    admin_winner_entry_id: null,
    starts_at: new Date(Date.now() - 7200000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    max_entries: 10,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    entries: MOCK_ENTRIES,
    winner_entry: null,
    group_winner_entry: MOCK_ENTRIES[0],
    admin_winner_entry: null,
  },
];

// ─── Conversation Themes ──────────────────────────────────────────────────────

export const MOCK_THEMES: ConversationTheme[] = [
  { id: "thm-001", name: "AI Agents & Automation", description: "Building autonomous workflows and agents", emoji: "🤖", category: "AI", sort_order: 1, is_archived: false, times_used: 3, created_at: "2026-01-01T00:00:00Z" },
  { id: "thm-002", name: "Founder Stories", description: "What's it actually like to build a startup?", emoji: "🚀", category: "Entrepreneurship", sort_order: 2, is_archived: false, times_used: 5, created_at: "2026-01-01T00:00:00Z" },
  { id: "thm-003", name: "The Future of Code", description: "Where is software development heading in 5 years?", emoji: "💻", category: "Tech", sort_order: 3, is_archived: false, times_used: 2, created_at: "2026-01-01T00:00:00Z" },
  { id: "thm-004", name: "Raising Your First Round", description: "Navigating pre-seed and seed funding in Canada", emoji: "💰", category: "Entrepreneurship", sort_order: 4, is_archived: false, times_used: 4, created_at: "2026-01-01T00:00:00Z" },
  { id: "thm-005", name: "Cursor Tips & Tricks", description: "Power-user workflows you should steal", emoji: "⚡", category: "Tools", sort_order: 5, is_archived: false, times_used: 6, created_at: "2026-01-01T00:00:00Z" },
  { id: "thm-006", name: "Side Projects → Startups", description: "When does a side project become a real company?", emoji: "🌱", category: "Entrepreneurship", sort_order: 6, is_archived: false, times_used: 1, created_at: "2026-01-01T00:00:00Z" },
];

export const MOCK_THEME_SELECTION: EventThemeSelection = {
  event_id: MOCK_EVENT.id,
  theme_id: "thm-005",
  selected_at: new Date(Date.now() - 3600000).toISOString(),
  theme: MOCK_THEMES[4],
};

// ─── Planned Events ───────────────────────────────────────────────────────────

export const MOCK_PLANNED_EVENTS: PlannedEvent[] = [
  { id: "pev-001", title: "Cursor Popup Calgary", event_date: "2026-02-18", end_date: null, start_time: "18:00", end_time: "22:00", venue: "Platform Calgary", address: "255 5 Ave SW", notes: "Feb edition — 80 cap", confirmed: true, city: "Calgary", linked_event_id: MOCK_EVENT.id, created_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-10T00:00:00Z" },
  { id: "pev-002", title: "Cursor Popup Calgary", event_date: "2026-03-18", end_date: null, start_time: "18:00", end_time: "22:00", venue: "Platform Calgary", address: "255 5 Ave SW", notes: "March edition", confirmed: true, city: "Calgary", linked_event_id: null, created_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-10T00:00:00Z" },
  { id: "pev-003", title: "Cursor Popup Vancouver", event_date: "2026-03-25", end_date: null, start_time: "18:30", end_time: "22:00", venue: "TBC", address: null, notes: "Scouting venue", confirmed: false, city: "Vancouver", linked_event_id: null, created_at: "2026-01-15T00:00:00Z", updated_at: "2026-01-15T00:00:00Z" },
  { id: "pev-004", title: "Cursor Popup Calgary", event_date: "2026-04-15", end_date: null, start_time: "18:00", end_time: "22:00", venue: "Platform Calgary", address: "255 5 Ave SW", notes: "April edition", confirmed: false, city: "Calgary", linked_event_id: null, created_at: "2026-01-15T00:00:00Z", updated_at: "2026-01-15T00:00:00Z" },
];

// ─── Venues ───────────────────────────────────────────────────────────────────

export const MOCK_VENUES: Venue[] = [
  { id: "ven-001", name: "Platform Calgary", address: "255 5 Ave SW, Calgary, AB", city: "Calgary", image_url: null, sort_order: 1, created_at: "2026-01-01T00:00:00Z" },
  { id: "ven-002", name: "Startup Edmonton", address: "10180 101 St NW, Edmonton, AB", city: "Edmonton", image_url: null, sort_order: 2, created_at: "2026-01-01T00:00:00Z" },
];

// ─── Calendar Cities ──────────────────────────────────────────────────────────

export const MOCK_CITIES: EventCalendarCity[] = [
  { id: "cit-001", name: "Calgary", sort_order: 1, created_at: "2026-01-01T00:00:00Z" },
  { id: "cit-002", name: "Edmonton", sort_order: 2, created_at: "2026-01-01T00:00:00Z" },
  { id: "cit-003", name: "Vancouver", sort_order: 3, created_at: "2026-01-01T00:00:00Z" },
];

// ─── Exchange Posts ───────────────────────────────────────────────────────────

export const MOCK_EXCHANGE_POSTS: ExchangePost[] = [
  {
    id: "exh-001",
    event_id: MOCK_EVENT.id,
    user_id: "usr-004",
    type: "need",
    category: "cursor-help",
    title: "Help getting Cursor to work with my monorepo",
    status: "open",
    matched_with: null,
    table_number: null,
    created_at: new Date(Date.now() - 2400000).toISOString(),
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    user: { id: "usr-004", name: "Emily Nguyen" },
  },
  {
    id: "exh-002",
    event_id: MOCK_EVENT.id,
    user_id: "usr-002",
    type: "offer",
    category: "design-ux",
    title: "Offering 20 min UX review of your project",
    status: "open",
    matched_with: null,
    table_number: 5,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    user: { id: "usr-002", name: "Sarah Moore" },
  },
  {
    id: "exh-003",
    event_id: MOCK_EVENT.id,
    user_id: "usr-003",
    type: "offer",
    category: "funding",
    title: "Happy to chat about early-stage fundraising",
    status: "open",
    matched_with: null,
    table_number: null,
    created_at: new Date(Date.now() - 1200000).toISOString(),
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    user: { id: "usr-003", name: "James Patel" },
  },
];

// ─── Table QR Codes ───────────────────────────────────────────────────────────

export const MOCK_TABLE_QR_CODES: TableQRCode[] = Array.from({ length: 8 }, (_, i) => ({
  id: `tbl-00${i + 1}`,
  event_id: MOCK_EVENT.id,
  table_number: i + 1,
  qr_image_url: null,
  storage_path: null,
  created_at: "2026-01-20T00:00:00Z",
}));

export const MOCK_TABLE_REGISTRATIONS: TableRegistration[] = [
  { id: "trs-001", event_id: MOCK_EVENT.id, user_id: "usr-001", table_number: 3, source: "qr", registered_at: new Date(Date.now() - 3000000).toISOString() },
  { id: "trs-002", event_id: MOCK_EVENT.id, user_id: "usr-002", table_number: 5, source: "smart_seating", registered_at: new Date(Date.now() - 2800000).toISOString() },
  { id: "trs-003", event_id: MOCK_EVENT.id, user_id: "usr-003", table_number: 3, source: "qr", registered_at: new Date(Date.now() - 2600000).toISOString() },
];

// ─── Networking Session ───────────────────────────────────────────────────────

export const MOCK_NETWORKING_SESSION: SpeedNetworkingSession = {
  id: "net-001",
  event_id: MOCK_EVENT.id,
  round_duration_seconds: 300,
  status: "idle",
  current_round: 0,
  created_at: new Date(Date.now() - 7200000).toISOString(),
  updated_at: new Date(Date.now() - 7200000).toISOString(),
};

// ─── Cursor Credits ───────────────────────────────────────────────────────────

export const MOCK_CURSOR_CREDITS: CursorCredit[] = [
  { id: "crd-001", event_id: MOCK_EVENT.id, credit_code: "CURSOR-DEMO-001", assigned_to: "usr-001", registration_id: "reg-001", amount_usd: 20, assigned_at: new Date(Date.now() - 1800000).toISOString(), redeemed_at: null, created_at: "2026-01-20T00:00:00Z", user: { name: "Alex Chen", email: "alex.chen@example.com" } },
  { id: "crd-002", event_id: MOCK_EVENT.id, credit_code: "CURSOR-DEMO-002", assigned_to: null, registration_id: null, amount_usd: 20, assigned_at: null, redeemed_at: null, created_at: "2026-01-20T00:00:00Z" },
  { id: "crd-003", event_id: MOCK_EVENT.id, credit_code: "CURSOR-DEMO-003", assigned_to: null, registration_id: null, amount_usd: 20, assigned_at: null, redeemed_at: null, created_at: "2026-01-20T00:00:00Z" },
];
