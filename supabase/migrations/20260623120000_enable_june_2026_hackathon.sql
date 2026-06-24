-- Enables the hackathon module for the Calgary June 24 2026 meetup.
-- Generic Cursor Meetup Hackathon (no SAIT / Megabyte branding).
-- Safe to run multiple times.
-- June 24 2026 is MDT (UTC-6). Coding window: 6:20 PM MDT = 00:20 UTC June 25; 8:20 PM MDT = 02:20 UTC June 25.

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

-- 1. Turn the June meetup into a hackathon-enabled event.
UPDATE public.events
SET is_hackathon = true
WHERE slug = 'calgary-june-2026';

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
  '2026-06-25T01:00:00Z',   -- 7:00 PM MDT, team formation closes (40 min to form)
  '2026-06-25T02:20:00Z',   -- 8:20 PM MDT, submission deadline (end of coding)
  '2026-06-25T02:25:00Z',   -- 8:25 PM MDT, judging starts (locks submissions at 8:20)
  2,
  4,
  false,
  E'Build something you''d actually use. Team up, prototype with Cursor, and ship a working demo before the deadline.'
FROM public.events e
WHERE e.slug = 'calgary-june-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.hackathon_settings hs
    WHERE hs.event_id = e.id
  );

UPDATE public.hackathon_settings hs
SET
  team_formation_enabled = true,
  team_formation_opens_at = NULL,
  team_formation_closes_at = '2026-06-25T01:00:00Z',
  submission_deadline = '2026-06-25T02:20:00Z',
  judging_starts_at = '2026-06-25T02:25:00Z',
  min_team_size = 2,
  max_team_size = 4,
  prompt_text = COALESCE(
    NULLIF(BTRIM(hs.prompt_text), ''),
    E'Build something you''d actually use. Team up, prototype with Cursor, and ship a working demo before the deadline.'
  ),
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-june-2026'
  AND hs.event_id = e.id
  -- Don't stomp a custom prompt an organizer may have already set.
  AND (hs.prompt_text IS NULL OR BTRIM(hs.prompt_text) IN ('', 'Sample prompt....xxx etc.'));

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
  '2026-06-25T00:20:00Z',   -- 6:20 PM MDT, coding starts
  '2026-06-25T02:20:00Z'    -- 8:20 PM MDT, submission deadline
FROM public.events e
WHERE e.slug = 'calgary-june-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.event_id = e.id
      AND c.title = 'Cursor Meetup Build Challenge'
  );

NOTIFY pgrst, 'reload schema';
