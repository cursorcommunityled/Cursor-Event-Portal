-- ── City tabs for the planning calendar ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_calendar_cities (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial cities
INSERT INTO event_calendar_cities (name, sort_order) VALUES
  ('Calgary', 1),
  ('Toronto', 2)
ON CONFLICT (name) DO NOTHING;

-- Add city column to planned_events
ALTER TABLE planned_events
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Calgary';

-- Index for filtering by city
CREATE INDEX IF NOT EXISTS idx_planned_events_city ON planned_events(city);
