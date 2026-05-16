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
