-- Creates the Calgary March 2026 event and sets it as the active event.
-- Safe to run multiple times.
-- March 25 2026 is after DST (MDT = UTC-6): 6:00 PM MDT = 00:00 UTC Mar 26

INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, status, capacity, timezone
)
SELECT
  'calgary-march-2026',
  'MAR2026',
  'Cursor Calgary March 2026',
  NULL,           -- venue TBD
  NULL,           -- address TBD
  NULL,           -- venue image TBD
  '2026-03-26T00:00:00Z',   -- 6:00 PM MDT March 25
  '2026-03-26T03:00:00Z',   -- 9:00 PM MDT March 25
  'published',
  65,
  'America/Edmonton'
WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'calgary-march-2026');

-- Set as the active event (homepage + admin login will point here)
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('active_event_slug', 'calgary-march-2026', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = 'calgary-march-2026',
      updated_at = NOW();
