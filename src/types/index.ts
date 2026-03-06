// Database types for Cursor Popup Portal

export type UserRole = "attendee" | "facilitator" | "staff" | "admin";
export type EventStatus = "draft" | "published" | "active" | "completed";
export type QuestionStatus = "open" | "answered" | "pinned" | "hidden";
export type RegistrationSource = "qr" | "link" | "walk-in";
export type AttendeeRoleCategory = "founder" | "professional" | "student" | "other";
export type FounderStage =
  | "idea"
  | "pre-seed"
  | "seed"
  | "series-a"
  | "series-b-plus"
  | "bootstrapped"
  | "other";
export type DegreeType =
  | "high-school"
  | "bachelors"
  | "masters"
  | "phd"
  | "bootcamp"
  | "other";
export type CursorExperience =
  | "none"
  | "curious"
  | "trialed"
  | "active"
  | "power";

export interface Event {
  id: string;
  slug: string;
  code: string;
  name: string;
  venue: string | null;
  address: string | null;
  capacity: number;
  start_time: string | null;
  end_time: string | null;
  status: EventStatus;
  seat_lockout_active: boolean;
  smart_seating_active: boolean;
  seating_enabled: boolean;
  survey_popup_visible: boolean;
  timezone: string;
  admin_code: string;
  data_retention_days: number;
  venue_image_url: string | null;
  timer_label: string | null;
  timer_end_time: string | null;
  timer_active: boolean;
  series_id: string | null;
  created_at: string;
}

export interface EventSeries {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TableQRCode {
  id: string;
  event_id: string;
  table_number: number;
  qr_image_url: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface TableRegistration {
  id: string;
  event_id: string;
  user_id: string;
  table_number: number;
  source: "qr" | "smart_seating";
  registered_at: string;
}

export interface DemoSignupSettings {
  id: string;
  event_id: string;
  is_enabled: boolean;
  speaker_name: string | null;
  opens_at: string;
  closes_at: string;
  created_at: string;
  updated_at: string;
}

export interface DemoSlot {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  created_at: string;
}

export interface DemoSlotSignup {
  id: string;
  event_id: string;
  slot_id: string;
  user_id: string;
  created_at: string;
  user?: Pick<User, "id" | "name" | "email">;
}

export interface User {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  // Profile goals/offers (persistent across events)
  goals?: IntakeGoalTag[];
  goals_other?: string | null;
  offers?: IntakeOfferTag[];
  offers_other?: string | null;
  role_category?: AttendeeRoleCategory | null;
  founder_stage?: FounderStage | null;
  years_experience?: number | null;
  degree_type?: DegreeType | null;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
  intent?: string | null;
  followup_consent?: boolean | null;
  cursor_experience?: CursorExperience | null;
  created_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  consent_at: string | null;
  survey_consent_at: string | null;
  source: RegistrationSource;
  checked_in_at: string | null;
  intake_completed_at?: string | null;
  created_at: string;
  // Joined fields
  user?: User & {
    intakes?: AttendeeIntake[];
  };
}

export interface AgendaItem {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  speaker: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  image_url: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  event_id: string;
  content: string;
  priority: number;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  tags: string[];
  upvotes: number;
  status: QuestionStatus;
  created_at: string;
  // Joined fields
  user?: User;
  answers?: Answer[];
  user_has_upvoted?: boolean;
}

export interface Answer {
  id: string;
  question_id: string;
  user_id: string;
  content: string;
  is_accepted: boolean;
  created_at: string;
  // Joined fields
  user?: User;
}

export interface QuestionUpvote {
  question_id: string;
  user_id: string;
}

export type HelpRequestStatus = "waiting" | "helping" | "resolved" | "cancelled";
export type HelpCategory = "Debugging" | "Design" | "Deployment" | "Cursor" | "Prompting" | "Other";

export interface HelpRequest {
  id: string;
  event_id: string;
  user_id: string;
  category: HelpCategory;
  description: string;
  status: HelpRequestStatus;
  claimed_by: string | null;
  created_at: string;
  resolved_at: string | null;
  user?: User;
  claimer?: User;
}

export interface Survey {
  id: string;
  event_id: string;
  title: string;
  schema: SurveySchema;
  published_at: string | null;
  created_at: string;
}

export interface SurveySchema {
  fields: SurveyField[];
}

export interface SurveyField {
  id: string;
  type: "text" | "textarea" | "rating" | "nps" | "select" | "multiselect";
  label: string;
  required: boolean;
  options?: string[];
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string | null;
  responses: Record<string, unknown>;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  event_id: string;
  passcode: string | null;
  expires_at: string;
  created_at: string;
}

// API types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface RegistrationFormData {
  name: string;
  email?: string;
  consent: boolean;
}

export interface QuestionFormData {
  content: string;
  tags: string[];
}

export interface AnswerFormData {
  content: string;
}

// Intake form types
export type IntakeGoalTag =
  | "learn-ai"
  | "learn-coding"
  | "networking"
  | "find-cofounders"
  | "hire-talent"
  | "find-job"
  | "explore-tools"
  | "other";

export type IntakeOfferTag =
  | "ai-expertise"
  | "software-dev"
  | "design"
  | "business-strategy"
  | "funding-investment"
  | "mentorship"
  | "collaboration"
  | "other";

export interface AttendeeIntake {
  id: string;
  event_id: string;
  user_id: string;
  goals: IntakeGoalTag[];
  goals_other: string | null;
  offers: IntakeOfferTag[];
  offers_other: string | null;
  role_category?: AttendeeRoleCategory | null;
  founder_stage?: FounderStage | null;
  years_experience?: number | null;
  degree_type?: DegreeType | null;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
  intent?: string | null;
  followup_consent?: boolean | null;
  cursor_experience?: CursorExperience | null;
  skipped: boolean;
  created_at: string;
  // Joined fields
  user?: User;
}

export interface IntakeFormData {
  goals: IntakeGoalTag[];
  goalsOther?: string;
  offers: IntakeOfferTag[];
  offersOther?: string;
  roleCategory?: AttendeeRoleCategory;
  founderStage?: FounderStage;
  yearsExperience?: number;
  degreeType?: DegreeType;
  linkedin?: string;
  github?: string;
  website?: string;
  intent?: string;
  followupConsent?: boolean;
  cursorExperience?: CursorExperience;
}

// Group formation types
export type GroupStatus = "pending" | "approved" | "modified" | "rejected";

export interface SuggestedGroup {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  status: GroupStatus;
  table_number: number | null;
  match_score: number | null;
  created_at: string;
  // Joined fields
  members?: SuggestedGroupMember[];
}

export interface SuggestedGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  match_reason: string | null;
  created_at: string;
  // Joined fields
  user?: User;
  intake?: AttendeeIntake;
}

// Slide deck types
export interface SlideDeck {
  id: string;
  event_id: string;
  pdf_url: string;
  storage_path: string;
  page_count: number | null;
  is_live: boolean;
  popup_visible: boolean;
  current_page: number;
  created_at: string;
  updated_at: string;
}

// Individual slide types (for admin-uploaded slides)
export interface Slide {
  id: string;
  event_id: string;
  title: string | null;
  image_url: string;
  sort_order: number;
  is_live: boolean;
  created_at: string;
}

// Display page types
export interface DisplayPageData {
  event: Event;
  currentSession: AgendaItem | null;
  nextSession: AgendaItem | null;
  recentQuestions: Question[];
  announcements: Announcement[];
  slideDeck: SlideDeck | null;
}

// LLM matching types
export interface GroupMatchingRequest {
  eventId: string;
  intakes: AttendeeIntake[];
  groupSize?: number;
}

export interface GroupMatchingResponse {
  groups: {
    name: string;
    description: string;
    memberIds: string[];
    matchReasons: Record<string, string>;
  }[];
}

// Poll types
export interface Poll {
  id: string;
  event_id: string;
  question: string;
  options: string[];
  ends_at: string | null;
  is_active: boolean;
  show_results: boolean;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface PollWithVotes extends Poll {
  votes: PollVote[];
  user_vote?: PollVote | null;
  vote_counts: number[];
  total_votes: number;
}

// Competition types
export type CompetitionStatus = "draft" | "active" | "voting" | "ended";
export type VotingMode = "group" | "judges" | "both" | "top3";
export type WinnerMethod = "auto" | "manual";

export interface Competition {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  rules: string | null;
  status: CompetitionStatus;
  voting_mode: VotingMode;
  winner_entry_id: string | null;
  winner_method: WinnerMethod | null;
  // top3 mode fields
  top3_entry_ids: string[] | null;
  group_winner_entry_id: string | null;
  admin_winner_entry_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_entries: number | null;
  created_at: string;
}

export interface CompetitionEntry {
  id: string;
  competition_id: string;
  user_id: string;
  title: string;
  description: string | null;
  repo_url: string;
  project_url: string | null;
  preview_image_url: string | null;
  video_url: string | null;
  created_at: string;
  // Joined fields
  user?: User;
  vote_count?: number;
  avg_score?: number;
}

export interface CompetitionVote {
  id: string;
  competition_id: string;
  entry_id: string;
  user_id: string;
  score: number;
  is_judge: boolean;
  created_at: string;
}

export interface CompetitionWithEntries extends Competition {
  entries: CompetitionEntry[];
  winner_entry?: CompetitionEntry | null;
  // top3 mode resolved entries
  group_winner_entry?: CompetitionEntry | null;
  admin_winner_entry?: CompetitionEntry | null;
}

// ─── Conversation Themes ─────────────────────────────────────────────────────

export interface ConversationTheme {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  category: string | null;
  sort_order: number;
  is_archived: boolean;
  times_used: number;
  created_at: string;
}

export interface EventThemeSelection {
  event_id: string;
  theme_id: string | null;
  selected_at: string;
  theme?: ConversationTheme | null;
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string;
  sort_order: number;
  created_at: string;
}

// ─── Planned Events (Planning Calendar) ──────────────────────────────────────

export interface PlannedEvent {
  id: string;
  title: string;
  event_date: string;      // DATE as ISO string (YYYY-MM-DD)
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  address: string | null;
  notes: string | null;
  confirmed: boolean;
  city: string;
  linked_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventCalendarCity {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// ─── Cursor Credits ───────────────────────────────────────────────────────────

export interface CursorCredit {
  id: string;
  event_id: string;
  credit_code: string;
  assigned_to: string | null;
  registration_id: string | null;
  amount_usd: number;
  assigned_at: string | null;
  redeemed_at: string | null;
  created_at: string;
  user?: { name: string; email: string | null };
}
