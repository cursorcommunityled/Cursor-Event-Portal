-- Creates the Calgary May 27 2026 meetup event.
-- Safe to run multiple times.
-- May 27 2026 is MDT (UTC-6): 5:30 PM MDT = 23:30 UTC; 8:30 PM MDT = 02:30 UTC May 28.

-- 0. Ensure prerequisite columns/tables exist on databases missing newer migrations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Edmonton',
  ADD COLUMN IF NOT EXISTS admin_code TEXT,
  ADD COLUMN IF NOT EXISTS is_hackathon BOOLEAN NOT NULL DEFAULT false;

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

-- 1. Create/update the published meetup event. Venue is intentionally TBD.
INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, timezone, status, capacity, admin_code, is_hackathon
)
VALUES (
  'calgary-may-2026',
  'MAY2026',
  'Cursor Calgary May 2026',
  NULL,
  NULL,
  NULL,
  '2026-05-27T23:30:00Z',   -- 5:30 PM MDT May 27
  '2026-05-28T02:30:00Z',   -- 8:30 PM MDT May 27
  'America/Edmonton',
  'published',
  65,
  LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0'),
  false
)
ON CONFLICT (slug) DO UPDATE
SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  venue = NULL,
  address = NULL,
  venue_image_url = NULL,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  timezone = EXCLUDED.timezone,
  status = EXCLUDED.status,
  capacity = EXCLUDED.capacity,
  is_hackathon = false,
  admin_code = COALESCE(public.events.admin_code, EXCLUDED.admin_code);

-- 2. Add it to the planning calendar and link it to the event row
INSERT INTO public.planned_events (
  title, event_date, end_date, start_time, end_time,
  venue, address, notes, confirmed, city, linked_event_id
)
SELECT
  'Cursor Calgary May 2026',
  '2026-05-27',
  NULL,
  '17:30',
  '20:30',
  NULL,
  NULL,
  'Regular Cursor Calgary meetup. Venue TBD; not House 831.',
  true,
  'Calgary',
  e.id
FROM public.events e
WHERE e.slug = 'calgary-may-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.planned_events pe
    WHERE pe.linked_event_id = e.id
       OR (pe.title = 'Cursor Calgary May 2026' AND pe.event_date = '2026-05-27')
  );

UPDATE public.planned_events pe
SET
  end_date = NULL,
  start_time = '17:30',
  end_time = '20:30',
  venue = NULL,
  address = NULL,
  notes = 'Regular Cursor Calgary meetup. Venue TBD; not House 831.',
  confirmed = true,
  city = 'Calgary',
  linked_event_id = e.id,
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-may-2026'
  AND (pe.linked_event_id = e.id OR (pe.title = 'Cursor Calgary May 2026' AND pe.event_date = '2026-05-27'));

-- 3. Replace any placeholder agenda with a standard meetup agenda
DELETE FROM public.agenda_items
WHERE event_id = (SELECT id FROM public.events WHERE slug = 'calgary-may-2026');

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
      'Arrival & Mingle',
      'Get settled in, meet other builders, and connect with the Cursor Calgary community.',
      '2026-05-27T23:30:00Z',
      '2026-05-28T00:00:00Z',
      0
    ),
    (
      'Intro to Cursor',
      'A quick overview of Cursor workflows, community updates, and how to get the most out of the evening.',
      '2026-05-28T00:00:00Z',
      '2026-05-28T00:10:00Z',
      1
    ),
    (
      'Speakers',
      'Short talks and demos from builders in the community.',
      '2026-05-28T00:10:00Z',
      '2026-05-28T00:30:00Z',
      2
    ),
    (
      'Build Session',
      'Use Cursor to work on an idea, prototype, or project with help from the community.',
      '2026-05-28T00:30:00Z',
      '2026-05-28T02:00:00Z',
      3
    ),
    (
      'Demos & Networking',
      'Share what you built, watch community demos, and keep the conversations going.',
      '2026-05-28T02:00:00Z',
      '2026-05-28T02:30:00Z',
      4
    )
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'calgary-may-2026';
