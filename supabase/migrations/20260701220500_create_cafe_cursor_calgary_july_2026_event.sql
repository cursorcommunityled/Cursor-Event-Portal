-- Creates the Cafe Cursor Calgary July 12 2026 co-working event.
-- Safe to run multiple times.
-- July 12 2026 is MDT (UTC-6): 9:00 AM MDT = 15:00 UTC; 5:00 PM MDT = 23:00 UTC.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Edmonton',
  ADD COLUMN IF NOT EXISTS admin_code TEXT,
  ADD COLUMN IF NOT EXISTS seating_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hackathon BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS luma_event_id TEXT;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.planned_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  event_date       DATE        NOT NULL,
  end_date         DATE,
  start_time       TIME,
  end_time         TIME,
  venue            TEXT,
  address          TEXT,
  notes            TEXT,
  confirmed        BOOLEAN     NOT NULL DEFAULT false,
  city             TEXT        NOT NULL DEFAULT 'Calgary',
  linked_event_id  UUID        REFERENCES public.events(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.planned_events
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Calgary',
  ADD COLUMN IF NOT EXISTS linked_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 1. Create/update the published Cafe Cursor event.
INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, timezone, status, capacity, admin_code, seating_enabled, is_hackathon, luma_event_id
)
VALUES (
  'cafe-cursor-calgary-july-2026',
  'CAFEJUL2026',
  'Cafe Cursor Calgary',
  'TBD',
  NULL,
  NULL,
  '2026-07-12T15:00:00Z',   -- 9:00 AM MDT July 12
  '2026-07-12T23:00:00Z',   -- 5:00 PM MDT July 12
  'America/Edmonton',
  'published',
  65,
  LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0'),
  false,
  false,
  'evt-aT80m2gTxN3w8FH'
)
ON CONFLICT (slug) DO UPDATE
SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  venue = EXCLUDED.venue,
  address = EXCLUDED.address,
  venue_image_url = EXCLUDED.venue_image_url,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  timezone = EXCLUDED.timezone,
  status = EXCLUDED.status,
  capacity = EXCLUDED.capacity,
  seating_enabled = false,
  is_hackathon = false,
  luma_event_id = EXCLUDED.luma_event_id,
  admin_code = COALESCE(public.events.admin_code, EXCLUDED.admin_code);

-- 2. Add it to the planning calendar and link it to the event row.
INSERT INTO public.planned_events (
  title, event_date, end_date, start_time, end_time,
  venue, address, notes, confirmed, city, linked_event_id
)
SELECT
  'Cafe Cursor Calgary',
  '2026-07-12',
  NULL,
  '09:00',
  '17:00',
  'TBD',
  NULL,
  'Cafe Cursor co-working day. Ticket windows: Co-working 9:00am-1:00pm, Co-working 1:00pm-5:00pm, and Drop-in 9:00am-5:00pm. Requires Luma approval; bring laptops.',
  true,
  'Calgary',
  e.id
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-july-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.planned_events pe
    WHERE pe.linked_event_id = e.id
       OR (pe.title = 'Cafe Cursor Calgary' AND pe.event_date = '2026-07-12')
  );

UPDATE public.planned_events pe
SET
  end_date = NULL,
  start_time = '09:00',
  end_time = '17:00',
  venue = 'TBD',
  address = NULL,
  notes = 'Cafe Cursor co-working day. Ticket windows: Co-working 9:00am-1:00pm, Co-working 1:00pm-5:00pm, and Drop-in 9:00am-5:00pm. Requires Luma approval; bring laptops.',
  confirmed = true,
  city = 'Calgary',
  linked_event_id = e.id,
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-july-2026'
  AND (pe.linked_event_id = e.id OR (pe.title = 'Cafe Cursor Calgary' AND pe.event_date = '2026-07-12'));

-- 3. Replace any placeholder agenda with the Cafe Cursor format.
DELETE FROM public.agenda_items
WHERE event_id = (SELECT id FROM public.events WHERE slug = 'cafe-cursor-calgary-july-2026');

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT
  e.id,
  v.title,
  v.description,
  v.start_time::timestamptz,
  v.end_time::timestamptz,
  v.sort_order
FROM public.events e
CROSS JOIN (
  VALUES
    (
      'Cafe Opens & Check-in',
      'Arrive, check in with your Luma registration email, grab a spot, and settle into the co-working day. Drop-in guests can stop by anytime from 9:00am-5:00pm.',
      '2026-07-12T15:00:00Z',
      '2026-07-12T15:15:00Z',
      0
    ),
    (
      'Morning Co-working',
      'For the 9:00am-1:00pm co-working ticket window: bring your laptop, work on your project, and swap Cursor workflows with nearby builders.',
      '2026-07-12T15:15:00Z',
      '2026-07-12T19:00:00Z',
      1
    ),
    (
      'Afternoon Co-working',
      'For the 1:00pm-5:00pm co-working ticket window: open build time, casual help, hallway conversations, and optional project sharing. Drop-in guests are welcome throughout the afternoon.',
      '2026-07-12T19:00:00Z',
      '2026-07-12T23:00:00Z',
      2
    )
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'cafe-cursor-calgary-july-2026';

-- 4. Make Cafe Cursor the attendee-facing event because it is the next Calgary event.
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('active_event_slug', 'cafe-cursor-calgary-july-2026', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

NOTIFY pgrst, 'reload schema';
