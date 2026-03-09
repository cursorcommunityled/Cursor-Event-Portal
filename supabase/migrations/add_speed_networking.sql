-- Speed Networking: sessions, rounds, and pairs
-- Run this in the Supabase SQL editor

-- ── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS speed_networking_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round_duration_seconds INTEGER NOT NULL DEFAULT 300,
  status                 TEXT NOT NULL DEFAULT 'idle'
                         CHECK (status IN ('idle', 'active', 'between_rounds', 'ended')),
  current_round          INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_networking_sessions_event_id
  ON speed_networking_sessions(event_id);

-- ── Rounds ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS speed_networking_rounds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES speed_networking_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  started_at   TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_networking_rounds_session_id
  ON speed_networking_rounds(session_id);

-- ── Pairs ─────────────────────────────────────────────────────────────────────
-- Each row = one matched pair (or wildcard solo) for a given round.
-- user2_id is nullable — NULL means the attendee is a "wildcard" (odd one out).
CREATE TABLE IF NOT EXISTS speed_networking_pairs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id     UUID NOT NULL REFERENCES speed_networking_rounds(id) ON DELETE CASCADE,
  session_id   UUID NOT NULL REFERENCES speed_networking_sessions(id) ON DELETE CASCADE,
  user1_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
  color_code   TEXT NOT NULL,
  match_reason TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_networking_pairs_round_id
  ON speed_networking_pairs(round_id);
CREATE INDEX IF NOT EXISTS idx_speed_networking_pairs_session_id
  ON speed_networking_pairs(session_id);
CREATE INDEX IF NOT EXISTS idx_speed_networking_pairs_user1_id
  ON speed_networking_pairs(user1_id);
CREATE INDEX IF NOT EXISTS idx_speed_networking_pairs_user2_id
  ON speed_networking_pairs(user2_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE speed_networking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_networking_rounds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_networking_pairs    ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all (needed for attendee screens)
CREATE POLICY "allow_read_sessions" ON speed_networking_sessions
  FOR SELECT USING (true);

CREATE POLICY "allow_read_rounds" ON speed_networking_rounds
  FOR SELECT USING (true);

CREATE POLICY "allow_read_pairs" ON speed_networking_pairs
  FOR SELECT USING (true);

-- Service role handles all writes (via server actions)
CREATE POLICY "allow_service_write_sessions" ON speed_networking_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "allow_service_write_rounds" ON speed_networking_rounds
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "allow_service_write_pairs" ON speed_networking_pairs
  FOR ALL USING (auth.role() = 'service_role');

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_speed_networking_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_speed_networking_sessions_updated_at
  BEFORE UPDATE ON speed_networking_sessions
  FOR EACH ROW EXECUTE FUNCTION update_speed_networking_sessions_updated_at();
