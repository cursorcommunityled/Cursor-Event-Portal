-- ─── Need/Offer Exchange Board ───────────────────────────────────────────────
-- Live micro-marketplace where attendees post immediate needs/offers
-- with auto-matching based on intake + table location.

CREATE TABLE IF NOT EXISTS exchange_posts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type IN ('need', 'offer')),
  category     text        NOT NULL,
  title        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'matched', 'closed')),
  matched_with uuid        REFERENCES users(id) ON DELETE SET NULL,
  table_number integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_exchange_posts_event_id
  ON exchange_posts(event_id);
CREATE INDEX IF NOT EXISTS idx_exchange_posts_event_status
  ON exchange_posts(event_id, status);
CREATE INDEX IF NOT EXISTS idx_exchange_posts_user_id
  ON exchange_posts(user_id);

-- RLS (permissive — same pattern as help_requests)
ALTER TABLE exchange_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_posts_read"   ON exchange_posts FOR SELECT USING (true);
CREATE POLICY "exchange_posts_insert" ON exchange_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "exchange_posts_update" ON exchange_posts FOR UPDATE USING (true);
CREATE POLICY "exchange_posts_delete" ON exchange_posts FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE exchange_posts;
