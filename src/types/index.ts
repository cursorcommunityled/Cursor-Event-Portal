// Database types for Cursor Popup Portal

export type UserRole = "attendee" | "facilitator" | "staff" | "admin";
export type EventStatus = "draft" | "published" | "active" | "completed" | "archived";
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
  is_hackathon: boolean;
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
  banner_image_url: string | null;
  opens_at: string;
  closes_at: string;
  created_at: string;
  updated_at: string;
}

export interface Mentor {
  id: string;
  event_id: string;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
  meet_link: string | null;
  virtual_call_instructions: string | null;
  mentorship_mode: 'virtual' | 'in_person' | 'hybrid';
  in_person_location: string | null;
  in_person_schedule: string | null;
  display_order: number;
  is_mentor: boolean;
  is_judge: boolean;
  created_at: string;
  updated_at: string;
}

export interface DemoSlot {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  title: string | null;
  host_name: string | null;
  description: string | null;
  location: string | null;
  session_type: string;
  mentor_id: string | null;
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
  phone?: string | null;
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
  hackathon_audience_vote: boolean;
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
  finalists?: CompetitionFinalistEntry[];
}

export interface CompetitionFinalistEntry {
  id: string;
  event_id: string;
  competition_id: string;
  entry_id: string;
  position: number;
  selected_by: string | null;
  selected_at: string;
  entry?: CompetitionEntry;
}

export interface CompetitionJudgingCriterion {
  id: string;
  event_id: string;
  competition_id: string;
  slug: string;
  label: string;
  description: string | null;
  max_points: number;
  weight: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetitionJudgingScoreItem {
  id: string;
  scorecard_id: string;
  criterion_id: string;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitionJudgingScorecard {
  id: string;
  event_id: string;
  competition_id: string;
  entry_id: string;
  judge_id: string;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  items: CompetitionJudgingScoreItem[];
  judge?: Pick<User, "id" | "name">;
  entry?: CompetitionEntry;
}

export interface CompetitionJudgingResult {
  id: string;
  event_id: string;
  competition_id: string;
  entry_id: string;
  placement: number;
  final_score: number;
  max_score: number;
  judge_count: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  entry?: CompetitionEntry;
  competition?: Pick<Competition, "id" | "title">;
}

export interface CompetitionJudgingStanding {
  competition_id: string;
  entry_id: string;
  placement: number;
  final_score: number;
  max_score: number;
  judge_count: number;
  entry: CompetitionEntry;
}

export interface CompetitionJudgingCompetition extends CompetitionWithEntries {
  finalists: CompetitionFinalistEntry[];
  criteria: CompetitionJudgingCriterion[];
  scorecards: CompetitionJudgingScorecard[];
  results: CompetitionJudgingResult[];
  standings: CompetitionJudgingStanding[];
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
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

// ─── Planned Events (Planning Calendar) ──────────────────────────────────────

export interface PlannedEvent {
  id: string;
  title: string;
  event_date: string;      // DATE as ISO string (YYYY-MM-DD) — start date
  end_date: string | null; // DATE as ISO string — null for single-day events
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  address: string | null;
  notes: string | null;
  confirmed: boolean;
  city: string;
  linked_event_id: string | null;
  linked_event: { id: string; slug: string; admin_code: string; status: string } | null;
  created_at: string;
  updated_at: string;
}

export interface EventCalendarCity {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// ─── Speed Networking ─────────────────────────────────────────────────────────

export type NetworkingSessionStatus = 'idle' | 'active' | 'between_rounds' | 'ended';

export interface SpeedNetworkingSession {
  id: string;
  event_id: string;
  round_duration_seconds: number;
  status: NetworkingSessionStatus;
  current_round: number;
  created_at: string;
  updated_at: string;
}

export interface SpeedNetworkingRound {
  id: string;
  session_id: string;
  round_number: number;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface SpeedNetworkingPair {
  id: string;
  round_id: string;
  session_id: string;
  user1_id: string;
  user2_id: string | null;
  color_code: string;
  match_reason: string | null;
  created_at: string;
  user1?: Pick<User, 'id' | 'name'>;
  user2?: Pick<User, 'id' | 'name'> | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'poll_opened'
  | 'table_assigned'
  | 'demo_slot_available'
  | 'survey_live'
  | 'announcement';

export type InAppNotificationType =
  | NotificationType
  | 'team_invite'
  | 'chat_mention';

export interface NotificationPreferences {
  user_id: string;
  event_id: string;
  poll_opened_inapp: boolean;
  poll_opened_email: boolean;
  table_assigned_inapp: boolean;
  table_assigned_email: boolean;
  demo_slot_inapp: boolean;
  demo_slot_email: boolean;
  survey_live_inapp: boolean;
  survey_live_email: boolean;
  announcements_inapp: boolean;
  announcements_email: boolean;
  updated_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  event_id: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export type ScheduledItemType = 'announcement' | 'poll';
export type ScheduledItemStatus = 'pending' | 'sent' | 'cancelled';

export interface ScheduledItem {
  id: string;
  event_id: string;
  type: ScheduledItemType;
  content: string | null;
  poll_question: string | null;
  poll_options: string[] | null;
  poll_duration_minutes: number | null;
  scheduled_at: string;
  status: ScheduledItemStatus;
  sent_at: string | null;
  created_at: string;
}

// ─── Exchange Board ───────────────────────────────────────────────────────────

export type ExchangePostType = 'need' | 'offer';
export type ExchangePostStatus = 'open' | 'matched' | 'closed';

export type ExchangeCategory =
  | 'react-frontend'
  | 'backend-api'
  | 'ai-integration'
  | 'cursor-help'
  | 'code-review'
  | 'design-ux'
  | 'pitch-feedback'
  | 'business-strategy'
  | 'funding'
  | 'mentorship'
  | 'co-founder'
  | 'other';

export const EXCHANGE_CATEGORIES: Array<{ id: ExchangeCategory; label: string; emoji: string }> = [
  { id: 'react-frontend',    label: 'React / Frontend',    emoji: '⚛️' },
  { id: 'backend-api',       label: 'Backend / API',        emoji: '🔧' },
  { id: 'ai-integration',    label: 'AI Integration',       emoji: '🤖' },
  { id: 'cursor-help',       label: 'Cursor Help',          emoji: '⚡' },
  { id: 'code-review',       label: 'Code Review',          emoji: '👀' },
  { id: 'design-ux',         label: 'Design / UX',          emoji: '🎨' },
  { id: 'pitch-feedback',    label: 'Pitch Feedback',       emoji: '🎯' },
  { id: 'business-strategy', label: 'Business Strategy',    emoji: '📈' },
  { id: 'funding',           label: 'Funding / Investment', emoji: '💰' },
  { id: 'mentorship',        label: 'Mentorship',           emoji: '🌱' },
  { id: 'co-founder',        label: 'Co-founder',           emoji: '🤝' },
  { id: 'other',             label: 'Other',                emoji: '✨' },
];

export interface ExchangePost {
  id: string;
  event_id: string;
  user_id: string;
  type: ExchangePostType;
  category: ExchangeCategory;
  title: string;
  status: ExchangePostStatus;
  matched_with: string | null;
  table_number: number | null;
  created_at: string;
  expires_at: string;
  // Joined
  user?: Pick<User, 'id' | 'name'>;
  matched_user?: Pick<User, 'id' | 'name'> | null;
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

// ─── Event Photos ─────────────────────────────────────────────────────────────

export type PhotoStatus = "pending" | "approved" | "rejected";
export type PhotoUsage = "event_gallery" | "hackathon_team_icon";

// ─── Hackathon ────────────────────────────────────────────────────────────────

export interface HackathonSettings {
  id: string;
  event_id: string;
  team_formation_enabled: boolean;
  team_formation_opens_at: string | null;
  team_formation_closes_at: string | null;
  submission_deadline: string | null;
  judging_starts_at: string | null;
  min_team_size: number;
  max_team_size: number;
  leaderboard_visible: boolean;
  prompt_text: string;
  created_at: string;
  updated_at: string;
}

export type HackathonTeamRole = 'leader' | 'member';
export type HackathonInviteStatus = 'pending' | 'accepted' | 'declined';

export interface HackathonTeam {
  id: string;
  event_id: string;
  name: string;
  created_by: string;
  icon_photo_id: string | null;
  locked_at: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface HackathonTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: HackathonTeamRole;
  joined_at: string;
  user?: Pick<User, 'id' | 'name'>;
}

export interface HackathonTeamInvite {
  id: string;
  team_id: string;
  event_id: string;
  invited_by: string;
  invited_user_id: string;
  status: HackathonInviteStatus;
  created_at: string;
  updated_at: string;
  team?: Pick<HackathonTeam, 'id' | 'name' | 'icon_photo_id'> & { icon_photo?: EventPhoto | null };
  inviter?: Pick<User, 'id' | 'name'>;
}

export interface HackathonProject {
  id: string;
  team_id: string;
  event_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HackathonRepoSubmissionBackup {
  id: string;
  event_id: string;
  team_id: string;
  submitted_by: string | null;
  team_name: string | null;
  project_name: string | null;
  description: string | null;
  repo_url: string;
  demo_url: string | null;
  primary_project_saved: boolean;
  primary_project_error: string | null;
  submission_payload: Record<string, unknown>;
  submitted_at: string;
  updated_at: string;
  team?: Pick<HackathonTeam, "id" | "name"> | null;
  submitter?: Pick<User, "id" | "name" | "email"> | null;
}

export interface HackathonScore {
  id: string;
  team_id: string;
  event_id: string;
  judge_id: string;
  innovation: number | null;
  technical_execution: number | null;
  functional_completeness: number | null;
  problem_solution_fit: number | null;
  ux_design: number | null;
  demo_communication: number | null;
  learning_ambition: number | null;
  // Legacy 4-column rubric fields kept for previously applied migrations.
  execution: number | null;
  presentation: number | null;
  ux_polish: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  judge?: Pick<User, 'id' | 'name'>;
}

export interface HackathonTeamWithMembers extends HackathonTeam {
  members: HackathonTeamMember[];
  project: HackathonProject | null;
  icon_photo?: EventPhoto | null;
}

// ─── Hackathon Chat ───────────────────────────────────────────────────────────

export type ChatChannelType = 'spawn_point' | 'general' | 'announcements' | 'team' | 'resources' | 'help' | 'dm';

export interface HackathonChatChannel {
  id: string;
  event_id: string;
  team_id: string | null;
  name: string;
  channel_type: ChatChannelType;
  position: number;
  created_at: string;
  unread_count?: number;
}

export interface HackathonChatMessage {
  id: string;
  channel_id: string;
  event_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  file_type: 'image' | 'file' | null;
  file_name: string | null;
  file_size_bytes: number | null;
  is_pinned: boolean;
  mentioned_user_ids: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  is_system_message: boolean;
  suggestion_user_id: string | null;
  user?: Pick<User, 'id' | 'name'>;
  reactions?: HackathonChatReaction[];
  sender_team?: { id: string; name: string; icon_photo?: EventPhoto | null } | null;
  sender_role?: UserRole | null;
  suggestion_user?: Pick<User, 'id' | 'name'> | null;
}

export interface HackathonChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: Pick<User, 'id' | 'name'>;
}

export interface ChatMember {
  id: string;
  name: string;
  role: UserRole;
  team?: { id: string; name: string; icon_photo?: EventPhoto | null } | null;
  team_role?: HackathonTeamRole | null;
  occupation?: string | null;
  is_technical?: boolean | null;
  unique_skill?: string | null;
  linkedin_url?: string | null;
  needs_team?: boolean | null;
  profile_bio?: string | null;
  project_interests?: string | null;
  collaboration_style?: string | null;
  looking_for_teammates?: string | null;
}

export interface HackathonProfile {
  id?: string;
  user_id: string;
  event_id: string;
  occupation: string | null;
  is_technical: boolean | null;
  unique_skill: string | null;
  linkedin_url: string | null;
  needs_team: boolean;
  accessibility?: string | null;
  profile_bio?: string | null;
  project_interests?: string | null;
  collaboration_style?: string | null;
  looking_for_teammates?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Event Photos ─────────────────────────────────────────────────────────────

export interface EventPhoto {
  id: string;
  event_id: string;
  uploaded_by: string | null;
  file_url: string;
  storage_path: string;
  caption: string | null;
  photo_usage: PhotoUsage;
  status: PhotoStatus;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  uploader?: Pick<User, "id" | "name" | "email">;
}
