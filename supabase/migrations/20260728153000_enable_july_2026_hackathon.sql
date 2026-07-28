-- Enables the hackathon module for the Calgary July 29 2026 meetup.
-- Same pattern as June 24 micro-hackathon; ZayZoon sponsor branding lives in the UI.
-- Safe to run multiple times.
-- July 29 2026 is MDT (UTC-6). Coding window: 6:20 PM MDT = 00:20 UTC July 30; 8:20 PM MDT = 02:20 UTC July 30.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure the hackathon flag column exists on databases missing newer migrations.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_hackathon BOOLEAN NOT NULL DEFAULT false;

-- Ensure the hackathon settings table exists (created in full by the hackathon setup migrations).
CREATE TABLE IF NOT EXISTS public.hackathon_settings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_formation_enabled    BOOLEAN     NOT NULL DEFAULT true,
  team_formation_opens_at   TIMESTAMPTZ,
  team_formation_closes_at  TIMESTAMPTZ,
  submission_deadline       TIMESTAMPTZ,
  judging_starts_at         TIMESTAMPTZ,
  min_team_size             INT         NOT NULL DEFAULT 2,
  max_team_size             INT         NOT NULL DEFAULT 4,
  leaderboard_visible       BOOLEAN     NOT NULL DEFAULT false,
  prompt_text               TEXT        NOT NULL DEFAULT 'Sample prompt....xxx etc.',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id)
);

-- 1. Turn the July meetup into a hackathon-enabled event and extend to 9:00 PM MDT.
UPDATE public.events
SET
  is_hackathon = true,
  end_time = '2026-07-30T03:00:00Z'   -- 9:00 PM MDT July 29
WHERE slug = 'calgary-july-2026';

-- 2. Configure hackathon mode for the coding window (6:20-8:20 PM MDT).
--    Team formation is open up front and closes 40 min in; coding runs until 8:20 PM.
--    The app auto-locks submissions 5 min before judging, so judging at 8:25 PM lands
--    the real submission lock exactly at 8:20 PM. Admins can adjust these on the night.
INSERT INTO public.hackathon_settings (
  event_id,
  team_formation_enabled,
  team_formation_opens_at,
  team_formation_closes_at,
  submission_deadline,
  judging_starts_at,
  min_team_size,
  max_team_size,
  leaderboard_visible,
  prompt_text
)
SELECT
  e.id,
  true,
  NULL,                     -- open immediately
  '2026-07-30T01:00:00Z',   -- 7:00 PM MDT, team formation closes (40 min to form)
  '2026-07-30T02:20:00Z',   -- 8:20 PM MDT, submission deadline (end of coding)
  '2026-07-30T02:25:00Z',   -- 8:25 PM MDT, judging starts (locks submissions at 8:20)
  1,                        -- min team size (solo teams allowed)
  4,
  false,
  E'Build something that goes beyond the typical budget feature of money in / money out — imagine what a worker who earns daily would actually find valuable when managing their day-to-day earnings in a budgeting tool.'
FROM public.events e
WHERE e.slug = 'calgary-july-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.hackathon_settings hs
    WHERE hs.event_id = e.id
  );

UPDATE public.hackathon_settings hs
SET
  team_formation_enabled = true,
  team_formation_opens_at = NULL,
  team_formation_closes_at = '2026-07-30T01:00:00Z',
  submission_deadline = '2026-07-30T02:20:00Z',
  judging_starts_at = '2026-07-30T02:25:00Z',
  min_team_size = 1,
  max_team_size = 4,
  prompt_text = E'Build something that goes beyond the typical budget feature of money in / money out — imagine what a worker who earns daily would actually find valuable when managing their day-to-day earnings in a budgeting tool.',
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-july-2026'
  AND hs.event_id = e.id;

-- 3. Pre-seed a generic build challenge competition (draft — admin activates it when ready).
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
  'Cursor Meetup Build Challenge',
  'Teams build a working prototype with Cursor during the meetup build session and demo it before the deadline.',
  E'1. Teams of 2-4 people.\n2. Build during the official meetup build session.\n3. Submit your repo URL and any demo materials before the submission deadline.\n4. Top teams demo live.\n5. Judging criteria: innovation, execution, completeness, problem-solution fit, UX, and ambition.',
  'draft',
  'judges',
  '2026-07-30T00:20:00Z',   -- 6:20 PM MDT, coding starts
  '2026-07-30T02:20:00Z'    -- 8:20 PM MDT, submission deadline
FROM public.events e
WHERE e.slug = 'calgary-july-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.event_id = e.id
      AND c.title = 'Cursor Meetup Build Challenge'
  );

-- 4. Replace agenda with the micro-hackathon run of show (5:30 PM -> 9:00 PM MDT).
DELETE FROM public.agenda_items
WHERE event_id = (SELECT id FROM public.events WHERE slug = 'calgary-july-2026');

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT e.id, v.title, v.description, v.start_time::timestamptz, v.end_time::timestamptz, v.sort_order
FROM public.events e
CROSS JOIN (
  VALUES
    ('Arrivals & Networking', 'Get settled in, grab a seat, and meet other builders at ZayZoon.',                   '2026-07-29T23:30:00Z', '2026-07-30T00:00:00Z', 0),
    ('Intro to Cursor',       'Quick overview of Cursor and how to get the most out of tonight.',                   '2026-07-30T00:00:00Z', '2026-07-30T00:10:00Z', 1),
    ('Demo',                  'Live demo to kick things off.',                                                     '2026-07-30T00:10:00Z', '2026-07-30T00:20:00Z', 2),
    ('microHACKATHON!!!',     'Form a team (1-4), build with Cursor, and ship a working demo before the deadline.', '2026-07-30T00:20:00Z', '2026-07-30T02:20:00Z', 3),
    ('AI Judging Round',      'AI screening scores every submitted project to pick the finalists.',                 '2026-07-30T02:20:00Z', '2026-07-30T02:30:00Z', 4),
    ('Finalists Demos',       'Top teams demo their builds live.',                                                 '2026-07-30T02:30:00Z', '2026-07-30T02:50:00Z', 5),
    ('Winners Announced',     'Winners revealed and celebrated — stick around to keep networking.',                 '2026-07-30T02:50:00Z', '2026-07-30T03:00:00Z', 6)
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'calgary-july-2026';

-- 5. Make July the attendee-facing event for tomorrow's meetup.
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('active_event_slug', 'calgary-july-2026', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Keep planning calendar end time in sync with the extended event window.
UPDATE public.planned_events pe
SET
  end_time = '21:00',
  notes = 'Cursor Calgary meetup at ZayZoon with a sponsored micro-hackathon. Bring laptops.',
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-july-2026'
  AND (pe.linked_event_id = e.id OR (pe.title = 'Cursor Calgary Meetup - July' AND pe.event_date = '2026-07-29'));

NOTIFY pgrst, 'reload schema';
