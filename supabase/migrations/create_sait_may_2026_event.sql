-- Creates the SAIT Hackathon May 2026 event and a pre-seeded hackathon competition.
-- Safe to run multiple times.
-- May 23 2026 is MDT (UTC-6): 9:00 AM MDT = 15:00 UTC; May 24 6:00 PM MDT = 00:00 UTC May 25

-- 1. Create the event
INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, status, capacity, admin_code
)
SELECT
  'calgary-hackathon-sait-may-2026',
  'SAIT2026',
  'Cursor Hackathon — SAIT',
  'SAIT Polytechnic',
  '1301 16 Ave NW, Calgary, AB T2M 0L4',
  NULL,
  '2026-05-23T15:00:00Z',   -- 9:00 AM MDT May 23
  '2026-05-25T00:00:00Z',   -- 6:00 PM MDT May 24
  'published',
  150,
  LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0')
WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'calgary-hackathon-sait-may-2026');

-- Ensure admin_code is set if row already existed with NULL
UPDATE public.events
SET admin_code = LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0')
WHERE slug = 'calgary-hackathon-sait-may-2026' AND admin_code IS NULL;

-- 2. Pre-seed the hackathon competition (draft — admin activates it when ready)
INSERT INTO public.competitions (
  event_id,
  title,
  description,
  rules,
  status,
  voting_mode,
  starts_at,
  ends_at
)
SELECT
  e.id,
  'Cursor Hackathon — Build Challenge',
  'Build a project using Cursor during the hackathon and submit your GitHub repo. The best projects win Cursor credits.',
  E'1. Teams of 1–4 people.\n2. Project must be built during the event.\n3. Submit a public GitHub repo URL.\n4. Include a short description of what you built and why.\n5. Judging based on creativity, technical execution, and use of Cursor.',
  'draft',
  'judges',
  '2026-05-23T15:00:00Z',   -- submissions open at event start
  '2026-05-24T21:00:00Z'    -- submissions close 3:00 PM MDT May 24
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.event_id = e.id
      AND c.title = 'Cursor Hackathon — Build Challenge'
  );
