-- ─── Easter Egg Hunt — March 25, 2026 Cursor Calgary ─────────────────────────
-- Run this in the Supabase SQL editor.
-- Three digital Easter eggs hidden in the portal, each worth a $50 Cursor credit.
-- Referral codes to be filled in by admin after the event (UPDATE easter_egg_hunts SET credit_code = '...' WHERE egg_id = 'egg_X' AND event_id = '<march-event-id>').

-- ── 1. Easter Egg Hunts Table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS easter_egg_hunts (
  egg_id        TEXT        NOT NULL,
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label         TEXT        NOT NULL,
  credit_code   TEXT,                            -- filled in later by admin
  claimed_by    UUID,                            -- user_id of first claimer
  claimed_at    TIMESTAMPTZ,
  PRIMARY KEY (egg_id, event_id)
);

ALTER TABLE easter_egg_hunts ENABLE ROW LEVEL SECURITY;

-- Anyone can read (to check claim status via server actions)
CREATE POLICY "Easter eggs readable by all"
  ON easter_egg_hunts FOR SELECT USING (true);

-- Only service role can update (claims are handled by server actions using service client)
-- (No anon/authenticated UPDATE policy — we use the service client in server actions)

-- ── 2. Seed Eggs for Calgary March 2026 ──────────────────────────────────────

INSERT INTO easter_egg_hunts (egg_id, event_id, label)
SELECT 'egg_1', e.id, 'The Venue Secret'
FROM events e WHERE e.slug = 'calgary-march-2026'
ON CONFLICT (egg_id, event_id) DO NOTHING;

INSERT INTO easter_egg_hunts (egg_id, event_id, label)
SELECT 'egg_2', e.id, 'The Resource Treasure'
FROM events e WHERE e.slug = 'calgary-march-2026'
ON CONFLICT (egg_id, event_id) DO NOTHING;

INSERT INTO easter_egg_hunts (egg_id, event_id, label)
SELECT 'egg_3', e.id, 'The Chat Spell'
FROM events e WHERE e.slug = 'calgary-march-2026'
ON CONFLICT (egg_id, event_id) DO NOTHING;

-- ── 3. Agenda Items for Calgary March 2026 ───────────────────────────────────
-- Times are UTC (MDT = UTC-6 in late March 2026).
-- NOTE: fix_march_2026_agenda.sql supersedes this — run that instead if possible.

INSERT INTO agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT
  e.id,
  v.title,
  v.description,
  v.start_time::timestamptz,
  v.end_time::timestamptz,
  v.sort_order
FROM events e
CROSS JOIN (VALUES
  (
    'Arrival & Mingle',
    'Get settled in, grab a drink, and connect with fellow builders.',
    '2026-03-25T23:30:00Z',
    '2026-03-26T00:00:00Z',
    1
  ),
  (
    'Intro to Cursor',
    'A quick overview of what Cursor can do and how to get the most out of tonight.',
    '2026-03-26T00:00:00Z',
    '2026-03-26T00:10:00Z',
    2
  ),
  (
    'Speakers',
    'Hear from builders and experts in the community.',
    '2026-03-26T00:10:00Z',
    '2026-03-26T00:30:00Z',
    3
  ),
  (
    'Build & Egg Hunt (Credits)',
    'Build your best idea with Cursor — and hunt for hidden $50 credit Easter eggs scattered across the venue and this app. First to find wins!',
    '2026-03-26T00:30:00Z',
    '2026-03-26T02:00:00Z',
    4
  ),
  (
    'Demos & Networking',
    'Present what you built, watch live demos, and connect with the community.',
    '2026-03-26T02:00:00Z',
    '2026-03-26T02:30:00Z',
    5
  )
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'calgary-march-2026'
ON CONFLICT DO NOTHING;
