-- ─── Fix / Reset Agenda for Calgary March 25, 2026 ───────────────────────────
-- Clears all existing agenda items for this event and inserts the correct 5.
-- Times are UTC (Mountain Daylight Time = UTC-6 in late March 2026).
--
--  5:30 PM MDT = 23:30 UTC Mar 25  |  6:00 PM MDT = 00:00 UTC Mar 26
--  6:10 PM MDT = 00:10 UTC Mar 26  |  6:30 PM MDT = 00:30 UTC Mar 26
--  8:00 PM MDT = 02:00 UTC Mar 26  |  8:30 PM MDT = 02:30 UTC Mar 26

-- 1. Wipe all existing items for this event
DELETE FROM agenda_items
WHERE event_id = (SELECT id FROM events WHERE slug = 'calgary-march-2026');

-- 2. Update event window to match real door time (5:30 PM MDT)
UPDATE events
SET
  start_time = '2026-03-25T23:30:00Z',
  end_time   = '2026-03-26T02:30:00Z'
WHERE slug = 'calgary-march-2026';

-- 3. Insert correct agenda
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
WHERE e.slug = 'calgary-march-2026';
