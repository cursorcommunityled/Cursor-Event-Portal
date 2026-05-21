-- ============================================================================
-- UX MONITORING EVENTS
-- ============================================================================
-- Captures generic user experience events such as clicks and client-side actions.
-- Page views continue to live in page_views; errors continue to live in error_logs.

CREATE TABLE IF NOT EXISTS ux_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  action TEXT,
  element TEXT,
  label TEXT,
  module TEXT,
  page_path TEXT,
  metadata JSONB,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ux_events_event_id ON ux_events(event_id);
CREATE INDEX IF NOT EXISTS idx_ux_events_user_id ON ux_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ux_events_session_id ON ux_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ux_events_event_type ON ux_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ux_events_module ON ux_events(module);
CREATE INDEX IF NOT EXISTS idx_ux_events_page_path ON ux_events(page_path);
CREATE INDEX IF NOT EXISTS idx_ux_events_created_at ON ux_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ux_events_event_created_at ON ux_events(event_id, created_at DESC);

ALTER TABLE ux_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "UX events are managed by service role" ON ux_events;
CREATE POLICY "UX events are managed by service role"
  ON ux_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ux_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ux_events;
  END IF;
END $$;
