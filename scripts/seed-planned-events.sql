-- ============================================================
-- Seed planned_events — Calgary calendar
-- Run in Supabase SQL Editor after running the migrations.
-- ============================================================

INSERT INTO planned_events (title, event_date, start_time, end_time, venue, address, notes, confirmed, city)
VALUES
  (
    'Calgary Cursor Meetup #3',
    '2026-03-25',
    '18:00',
    '21:00',
    'TBD',          -- update when venue is confirmed
    'Calgary, AB',
    'Theme: TBD',
    false,
    'Calgary'
  )
ON CONFLICT DO NOTHING;

-- ── Add future Calgary events below ──────────────────────────
-- INSERT INTO planned_events (title, event_date, start_time, end_time, venue, address, notes, confirmed, city)
-- VALUES ('Calgary Cursor Meetup #4', '2026-04-29', '18:00', '21:00', 'TBD', 'Calgary, AB', '', false, 'Calgary');
