-- Cursor Popup Portal Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee', 'facilitator', 'staff', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  venue TEXT,
  address TEXT,
  capacity INTEGER NOT NULL DEFAULT 65,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'link', 'walk-in')),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Agenda items table
CREATE TABLE IF NOT EXISTS agenda_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  speaker TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  upvotes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'pinned', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Question upvotes table
CREATE TABLE IF NOT EXISTS question_upvotes (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, user_id)
);

-- Answers table
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  schema JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  responses JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions table (for magic links and passcodes)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  passcode TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_event_id ON questions(event_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_question_upvotes_question_id ON question_upvotes(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_event_id ON agenda_items(event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_event_id ON announcements(event_id);
CREATE INDEX IF NOT EXISTS idx_surveys_event_id ON surveys(event_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_slides_event_id ON slides(event_id);
CREATE INDEX IF NOT EXISTS idx_slides_sort_order ON slides(sort_order);

-- Function to update question upvotes count
CREATE OR REPLACE FUNCTION update_question_upvotes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE questions SET upvotes = upvotes + 1 WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE questions SET upvotes = upvotes - 1 WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for question upvotes
DROP TRIGGER IF EXISTS trigger_update_question_upvotes ON question_upvotes;
CREATE TRIGGER trigger_update_question_upvotes
  AFTER INSERT OR DELETE ON question_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_question_upvotes();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Agenda items: public read; mutations only via service-role server actions
CREATE POLICY "Agenda items are viewable by everyone" ON agenda_items FOR SELECT USING (true);

-- Announcements: public read; mutations only via service-role server actions
CREATE POLICY "Announcements are viewable by everyone" ON announcements FOR SELECT USING (true);

-- Sessions: server-only (passcodes are sensitive). Service role bypasses RLS,
-- so loginWithPasscode / createPasscodeSession keep working.

-- Basic RLS policies (allow all reads, restrict writes based on auth)
-- In production, you'd want more restrictive policies

-- Users: Allow read, restrict write to authenticated users
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be inserted by service role" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can be updated by service role" ON users FOR UPDATE USING (true);

-- Events: Allow read, restrict write
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Events can be inserted by service role" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Events can be updated by service role" ON events FOR UPDATE USING (true);

-- Registrations: Allow read, restrict write
CREATE POLICY "Registrations are viewable by everyone" ON registrations FOR SELECT USING (true);
CREATE POLICY "Registrations can be inserted by service role" ON registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Registrations can be updated by service role" ON registrations FOR UPDATE USING (true);

-- Questions: Allow read, restrict write
CREATE POLICY "Questions are viewable by everyone" ON questions FOR SELECT USING (true);
CREATE POLICY "Questions can be inserted by service role" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Questions can be updated by service role" ON questions FOR UPDATE USING (true);

-- Answers: Allow read, restrict write
CREATE POLICY "Answers are viewable by everyone" ON answers FOR SELECT USING (true);
CREATE POLICY "Answers can be inserted by service role" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Answers can be updated by service role" ON answers FOR UPDATE USING (true);

-- Question upvotes: Allow read, restrict write
CREATE POLICY "Question upvotes are viewable by everyone" ON question_upvotes FOR SELECT USING (true);
CREATE POLICY "Question upvotes can be inserted by service role" ON question_upvotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Question upvotes can be deleted by service role" ON question_upvotes FOR DELETE USING (true);

-- Surveys: Allow read, restrict write
CREATE POLICY "Surveys are viewable by everyone" ON surveys FOR SELECT USING (true);
CREATE POLICY "Surveys can be inserted by service role" ON surveys FOR INSERT WITH CHECK (true);
CREATE POLICY "Surveys can be updated by service role" ON surveys FOR UPDATE USING (true);

-- Survey responses: Allow read, restrict write
CREATE POLICY "Survey responses are viewable by everyone" ON survey_responses FOR SELECT USING (true);
CREATE POLICY "Survey responses can be inserted by service role" ON survey_responses FOR INSERT WITH CHECK (true);

-- Attendee intake responses (goals and offers for networking)
CREATE TABLE IF NOT EXISTS attendee_intakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goals TEXT[] DEFAULT '{}',
  goals_other TEXT,
  offers TEXT[] DEFAULT '{}',
  offers_other TEXT,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Suggested groups from LLM matching
CREATE TABLE IF NOT EXISTS suggested_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'modified', 'rejected')),
  table_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group members (junction table)
CREATE TABLE IF NOT EXISTS suggested_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES suggested_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Slides table for display screen
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add intake completion tracking to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ;

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_attendee_intakes_event_id ON attendee_intakes(event_id);
CREATE INDEX IF NOT EXISTS idx_attendee_intakes_user_id ON attendee_intakes(user_id);
CREATE INDEX IF NOT EXISTS idx_suggested_groups_event_id ON suggested_groups(event_id);
CREATE INDEX IF NOT EXISTS idx_suggested_groups_table_number ON suggested_groups(event_id, table_number) WHERE table_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suggested_group_members_group_id ON suggested_group_members(group_id);

-- RLS for new tables
ALTER TABLE attendee_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_group_members ENABLE ROW LEVEL SECURITY;

-- Attendee intakes policies
CREATE POLICY "Intakes are viewable by everyone" ON attendee_intakes FOR SELECT USING (true);
CREATE POLICY "Intakes can be inserted by service role" ON attendee_intakes FOR INSERT WITH CHECK (true);
CREATE POLICY "Intakes can be updated by service role" ON attendee_intakes FOR UPDATE USING (true);

-- Suggested groups policies
CREATE POLICY "Groups are viewable by everyone" ON suggested_groups FOR SELECT USING (true);
CREATE POLICY "Groups can be inserted by service role" ON suggested_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Groups can be updated by service role" ON suggested_groups FOR UPDATE USING (true);

-- Group members policies
CREATE POLICY "Group members are viewable by everyone" ON suggested_group_members FOR SELECT USING (true);
CREATE POLICY "Group members can be inserted by service role" ON suggested_group_members FOR INSERT WITH CHECK (true);

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  show_results BOOLEAN NOT NULL DEFAULT FALSE,
  hackathon_audience_vote BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- Indexes for polls
CREATE INDEX IF NOT EXISTS idx_polls_event_id ON polls(event_id);
CREATE INDEX IF NOT EXISTS idx_polls_is_active ON polls(is_active);
CREATE INDEX IF NOT EXISTS idx_polls_hackathon_audience_vote
  ON polls(event_id, hackathon_audience_vote, is_active)
  WHERE hackathon_audience_vote = true;
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);

-- RLS for polls
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls policies
CREATE POLICY "Polls are viewable by everyone" ON polls FOR SELECT USING (true);
CREATE POLICY "Polls can be inserted by service role" ON polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Polls can be updated by service role" ON polls FOR UPDATE USING (true);
CREATE POLICY "Polls can be deleted by service role" ON polls FOR DELETE USING (true);

-- Poll votes policies
CREATE POLICY "Poll votes are viewable by everyone" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Poll votes can be inserted by service role" ON poll_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Poll votes can be deleted by service role" ON poll_votes FOR DELETE USING (true);

-- RLS for slides
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

-- Slides policies
CREATE POLICY "Slides are viewable by everyone" ON slides FOR SELECT USING (true);
CREATE POLICY "Slides can be inserted by service role" ON slides FOR INSERT WITH CHECK (true);
CREATE POLICY "Slides can be updated by service role" ON slides FOR UPDATE USING (true);
CREATE POLICY "Slides can be deleted by service role" ON slides FOR DELETE USING (true);

-- Insert sample event
INSERT INTO events (slug, code, name, venue, address, capacity, start_time, end_time, status)
VALUES (
  'calgary-jan-2026',
  '530',
  'Calgary Cursor Meetup - January 2026',
  'TBD',
  'Calgary, AB',
  65,
  '2026-01-29 00:30:00+00',
  '2026-01-29 03:30:00+00',
  'published'
) ON CONFLICT (slug) DO NOTHING;

