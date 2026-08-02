-- Creates the Calgary August 26 2026 meetup event + landing listing fields.
-- Safe to run multiple times.
-- Aug 26 2026 is MDT (UTC-6): 5:30 PM MDT = 23:30 UTC; 8:30 PM MDT = 02:30 UTC Aug 27.
-- Luma: https://luma.com/j63wlf2s (evt-jLpfGqGA6Ulc47E)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Edmonton',
  ADD COLUMN IF NOT EXISTS admin_code TEXT,
  ADD COLUMN IF NOT EXISTS seating_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hackathon BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS luma_event_id TEXT,
  ADD COLUMN IF NOT EXISTS luma_url TEXT,
  ADD COLUMN IF NOT EXISTS landing_description TEXT,
  ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN NOT NULL DEFAULT true;

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
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS luma_url TEXT;

-- 1. Create/update the published August meetup.
INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, timezone, status, capacity, admin_code,
  seating_enabled, is_hackathon, luma_event_id, luma_url, landing_description, show_on_landing
)
VALUES (
  'calgary-august-2026',
  'AUG2026',
  'Cursor Calgary Meetup - August',
  'TBD',
  NULL,
  NULL,
  '2026-08-26T23:30:00Z',   -- 5:30 PM MDT August 26
  '2026-08-27T02:30:00Z',   -- 8:30 PM MDT August 26
  'America/Edmonton',
  'published',
  65,
  LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0'),
  true,
  false,
  'evt-jLpfGqGA6Ulc47E',
  'https://luma.com/j63wlf2s',
  'Bring your laptop for speakers, a hands-on build session, demos, and networking with the Cursor Calgary community.',
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  venue = EXCLUDED.venue,
  address = EXCLUDED.address,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  timezone = EXCLUDED.timezone,
  status = EXCLUDED.status,
  capacity = EXCLUDED.capacity,
  seating_enabled = EXCLUDED.seating_enabled,
  is_hackathon = false,
  luma_event_id = EXCLUDED.luma_event_id,
  luma_url = EXCLUDED.luma_url,
  landing_description = EXCLUDED.landing_description,
  show_on_landing = true,
  admin_code = COALESCE(public.events.admin_code, EXCLUDED.admin_code);

-- Also update if an older row was created under a different slug with this Luma id.
UPDATE public.events
SET
  slug = 'calgary-august-2026',
  code = 'AUG2026',
  name = 'Cursor Calgary Meetup - August',
  venue = COALESCE(NULLIF(venue, ''), 'TBD'),
  start_time = '2026-08-26T23:30:00Z',
  end_time = '2026-08-27T02:30:00Z',
  timezone = 'America/Edmonton',
  status = 'published',
  luma_event_id = 'evt-jLpfGqGA6Ulc47E',
  luma_url = 'https://luma.com/j63wlf2s',
  landing_description = 'Bring your laptop for speakers, a hands-on build session, demos, and networking with the Cursor Calgary community.',
  show_on_landing = true
WHERE luma_event_id = 'evt-jLpfGqGA6Ulc47E'
   OR slug = 'calgary-august-2026';

-- 2. Planning calendar row + Luma URL for future promote/import flows.
INSERT INTO public.planned_events (
  title, event_date, end_date, start_time, end_time,
  venue, address, notes, confirmed, city, linked_event_id, luma_url
)
SELECT
  'Cursor Calgary Meetup - August',
  '2026-08-26',
  NULL,
  '17:30',
  '20:30',
  'TBD',
  NULL,
  'Regular Cursor Calgary meetup. Venue TBD. Bring laptops; programming is tentative and subject to change.',
  true,
  'Calgary',
  e.id,
  'https://luma.com/j63wlf2s'
FROM public.events e
WHERE e.slug = 'calgary-august-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.planned_events pe
    WHERE pe.linked_event_id = e.id
       OR (pe.title = 'Cursor Calgary Meetup - August' AND pe.event_date = '2026-08-26')
  );

UPDATE public.planned_events pe
SET
  end_date = NULL,
  start_time = '17:30',
  end_time = '20:30',
  venue = 'TBD',
  address = NULL,
  notes = 'Regular Cursor Calgary meetup. Venue TBD. Bring laptops; programming is tentative and subject to change.',
  confirmed = true,
  city = 'Calgary',
  linked_event_id = e.id,
  luma_url = 'https://luma.com/j63wlf2s',
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-august-2026'
  AND (
    pe.linked_event_id = e.id
    OR (pe.title = 'Cursor Calgary Meetup - August' AND pe.event_date = '2026-08-26')
  );

-- 3. Agenda (matches Luma schedule).
DELETE FROM public.agenda_items
WHERE event_id = (SELECT id FROM public.events WHERE slug = 'calgary-august-2026');

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
      'Arrivals & Mingle',
      'Get settled in, meet other builders, and connect with the Cursor Calgary community.',
      '2026-08-26T23:30:00Z',
      '2026-08-27T00:00:00Z',
      0
    ),
    (
      'Intro to Cursor',
      'A quick overview of Cursor workflows, community updates, and how to get the most out of the evening.',
      '2026-08-27T00:00:00Z',
      '2026-08-27T00:10:00Z',
      1
    ),
    (
      'Speakers',
      'Short talks and demos from builders in the community.',
      '2026-08-27T00:10:00Z',
      '2026-08-27T00:30:00Z',
      2
    ),
    (
      'Build Session',
      'Use Cursor to work on an idea, prototype, or project with help from the community.',
      '2026-08-27T00:30:00Z',
      '2026-08-27T02:00:00Z',
      3
    ),
    (
      'Demos & Networking',
      'Share what you built, watch community demos, and keep the conversations going.',
      '2026-08-27T02:00:00Z',
      '2026-08-27T02:30:00Z',
      4
    )
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'calgary-august-2026';

-- Keep Cafe Cursor (today) as the active portal event; do not switch active slug.

NOTIFY pgrst, 'reload schema';
