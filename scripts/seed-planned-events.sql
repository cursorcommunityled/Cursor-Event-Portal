-- ============================================================
-- Seed planned_events for the Calgary calendar
-- Run in Supabase SQL Editor after migrations are applied
-- ============================================================

-- March 25, 2026 — Calgary Cursor Meetup
INSERT INTO planned_events (title, event_date, start_time, end_time, venue, address, notes, confirmed, city)
VALUES (
  'Calgary Cursor Meetup',
  '2026-03-25',
  '18:00',
  '21:00',
  'TBD',        -- update with venue name
  'Calgary, AB', -- update with full address
  '',
  false,
  'Calgary'
)
ON CONFLICT DO NOTHING;

-- ── Add more rows below in the same format ────────────────────────────────────
-- INSERT INTO planned_events (title, event_date, start_time, end_time, venue, address, notes, confirmed, city)
-- VALUES ('...', '2026-04-29', '18:00', '21:00', '...', 'Calgary, AB', '', false, 'Calgary');
