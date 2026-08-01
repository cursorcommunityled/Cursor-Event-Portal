UPDATE public.events
SET
  slug = 'cafe-cursor-calgary-aug-2026',
  code = 'CAFEAUG2026',
  name = 'Cafe Cursor Calgary',
  venue = 'HOUSE 831',
  address = '831 17 Ave SW, Calgary, AB T2T 0A1',
  venue_image_url = '/house-831.webp',
  start_time = '2026-08-02T15:00:00Z',
  end_time = '2026-08-02T23:00:00Z',
  timezone = 'America/Edmonton',
  status = 'published',
  capacity = 120,
  seating_enabled = false,
  is_hackathon = false,
  luma_event_id = 'evt-aT80m2gTxN3w8FH'
WHERE slug IN ('cafe-cursor-calgary-july-2026', 'cafe-cursor-calgary-aug-2026')
   OR luma_event_id = 'evt-aT80m2gTxN3w8FH';

INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, timezone, status, capacity, admin_code,
  seating_enabled, is_hackathon, luma_event_id
)
SELECT
  'cafe-cursor-calgary-aug-2026',
  'CAFEAUG2026',
  'Cafe Cursor Calgary',
  'HOUSE 831',
  '831 17 Ave SW, Calgary, AB T2T 0A1',
  '/house-831.webp',
  '2026-08-02T15:00:00Z',
  '2026-08-02T23:00:00Z',
  'America/Edmonton',
  'published',
  120,
  LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0'),
  false,
  false,
  'evt-aT80m2gTxN3w8FH'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.events
  WHERE slug = 'cafe-cursor-calgary-aug-2026'
     OR luma_event_id = 'evt-aT80m2gTxN3w8FH'
);

UPDATE public.planned_events pe
SET
  title = 'Cafe Cursor Calgary',
  event_date = '2026-08-02',
  end_date = NULL,
  start_time = '09:00',
  end_time = '17:00',
  venue = 'HOUSE 831',
  address = '831 17 Ave SW, Calgary, AB T2T 0A1',
  notes = 'Cafe Cursor co-working day at HOUSE 831. Luma approval required.',
  confirmed = true,
  city = 'Calgary',
  linked_event_id = e.id,
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-aug-2026'
  AND (
    pe.linked_event_id = e.id
    OR (pe.title = 'Cafe Cursor Calgary' AND pe.event_date IN ('2026-07-12', '2026-08-02'))
  );

INSERT INTO public.planned_events (
  title, event_date, end_date, start_time, end_time,
  venue, address, notes, confirmed, city, linked_event_id
)
SELECT
  'Cafe Cursor Calgary',
  '2026-08-02',
  NULL,
  '09:00',
  '17:00',
  'HOUSE 831',
  '831 17 Ave SW, Calgary, AB T2T 0A1',
  'Cafe Cursor co-working day at HOUSE 831. Luma approval required.',
  true,
  'Calgary',
  e.id
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-aug-2026'
  AND NOT EXISTS (
    SELECT 1
    FROM public.planned_events pe
    WHERE pe.linked_event_id = e.id
       OR (pe.title = 'Cafe Cursor Calgary' AND pe.event_date = '2026-08-02')
  );

DELETE FROM public.planned_events
WHERE title = 'Cafe Cursor Calgary'
  AND event_date = '2026-07-12'
  AND linked_event_id IS DISTINCT FROM (
    SELECT id FROM public.events WHERE slug = 'cafe-cursor-calgary-aug-2026'
  );

DELETE FROM public.agenda_items
WHERE event_id = (
  SELECT id FROM public.events WHERE slug = 'cafe-cursor-calgary-aug-2026'
);

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT
  e.id,
  'Check-in',
  'Arrive with your Luma registration, grab a spot, and settle in. Drop-in guests welcome anytime 9:00am-5:00pm.',
  '2026-08-02T15:00:00Z'::timestamptz,
  '2026-08-02T15:15:00Z'::timestamptz,
  0
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-aug-2026';

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT
  e.id,
  'Morning Co-working',
  'For the Co-working 9:00am-1:00pm ticket. Bring your laptop, build, and swap Cursor workflows. Free coffee and patio open.',
  '2026-08-02T15:15:00Z'::timestamptz,
  '2026-08-02T19:00:00Z'::timestamptz,
  1
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-aug-2026';

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT
  e.id,
  'Afternoon Co-working',
  'For the Co-working 1:00pm-5:00pm ticket. Open build time, casual help, and networking. Drop-in guests welcome through 5:00pm.',
  '2026-08-02T19:00:00Z'::timestamptz,
  '2026-08-02T23:00:00Z'::timestamptz,
  2
FROM public.events e
WHERE e.slug = 'cafe-cursor-calgary-aug-2026';

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('active_event_slug', 'cafe-cursor-calgary-aug-2026', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

NOTIFY pgrst, 'reload schema';
