-- Creates the SAIT Hackathon May 2026 event and supporting setup.
-- Safe to run multiple times.
-- May 23/24 2026 is MDT (UTC-6): 8:00 AM MDT = 14:00 UTC; 3:30 PM MDT = 21:30 UTC.

-- 0. Ensure prerequisite columns/tables exist on databases missing newer migrations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Edmonton',
  ADD COLUMN IF NOT EXISTS admin_code TEXT,
  ADD COLUMN IF NOT EXISTS is_hackathon BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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

ALTER TABLE public.hackathon_settings
  ADD COLUMN IF NOT EXISTS team_formation_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_formation_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS team_formation_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS judging_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_team_size INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_team_size INT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS leaderboard_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_text TEXT NOT NULL DEFAULT 'Sample prompt....xxx etc.',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

WITH ranked_settings AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY event_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM public.hackathon_settings
)
DELETE FROM public.hackathon_settings hs
USING ranked_settings r
WHERE hs.id = r.id
  AND r.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS hackathon_settings_event_id_unique
  ON public.hackathon_settings(event_id);

CREATE TABLE IF NOT EXISTS public.hackathon_teams (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_by  UUID        NOT NULL REFERENCES public.users(id),
  icon_photo_id UUID,
  locked_at   TIMESTAMPTZ,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hackathon_teams
  ADD COLUMN IF NOT EXISTS icon_photo_id UUID,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_hackathon_teams_icon_photo_id
  ON public.hackathon_teams(icon_photo_id);

CREATE TABLE IF NOT EXISTS public.hackathon_team_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID        NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES public.users(id),
  role      TEXT        NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.hackathon_team_invites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID        NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_by      UUID        NOT NULL REFERENCES public.users(id),
  invited_user_id UUID        NOT NULL REFERENCES public.users(id),
  status          TEXT        NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hackathon_team_invites
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS hackathon_team_invites_pending_unique
  ON public.hackathon_team_invites(team_id, invited_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.hackathon_projects (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID        NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  repo_url      TEXT,
  demo_url      TEXT,
  video_url     TEXT,
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id)
);

ALTER TABLE public.hackathon_projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS repo_url TEXT,
  ADD COLUMN IF NOT EXISTS demo_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.hackathon_scores (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID        NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  judge_id      UUID        NOT NULL REFERENCES public.users(id),
  innovation    INT         CHECK (innovation BETWEEN 0 AND 10),
  execution     INT         CHECK (execution BETWEEN 0 AND 10),
  presentation  INT         CHECK (presentation BETWEEN 0 AND 10),
  ux_polish     INT         CHECK (ux_polish BETWEEN 0 AND 10),
  technical_execution INT   CHECK (technical_execution BETWEEN 0 AND 10),
  functional_completeness INT CHECK (functional_completeness BETWEEN 0 AND 10),
  problem_solution_fit INT CHECK (problem_solution_fit BETWEEN 0 AND 10),
  ux_design     INT         CHECK (ux_design BETWEEN 0 AND 10),
  demo_communication INT    CHECK (demo_communication BETWEEN 0 AND 10),
  learning_ambition INT     CHECK (learning_ambition BETWEEN 0 AND 10),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, judge_id)
);

ALTER TABLE public.hackathon_scores
  ADD COLUMN IF NOT EXISTS innovation INT CHECK (innovation BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS execution INT CHECK (execution BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS presentation INT CHECK (presentation BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS ux_polish INT CHECK (ux_polish BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS technical_execution INT CHECK (technical_execution BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS functional_completeness INT CHECK (functional_completeness BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS problem_solution_fit INT CHECK (problem_solution_fit BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS ux_design INT CHECK (ux_design BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS demo_communication INT CHECK (demo_communication BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS learning_ambition INT CHECK (learning_ambition BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'voting', 'ended')),
  voting_mode TEXT NOT NULL DEFAULT 'group' CHECK (voting_mode IN ('group', 'judges', 'both', 'top3')),
  winner_entry_id UUID,
  winner_method TEXT CHECK (winner_method IN ('auto', 'manual')),
  top3_entry_ids UUID[],
  group_winner_entry_id UUID,
  admin_winner_entry_id UUID,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_entries INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  repo_url TEXT NOT NULL,
  project_url TEXT,
  preview_image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.competition_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.competition_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 1 CHECK (score >= 1 AND score <= 5),
  is_judge BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id, entry_id)
);

-- Clean up older partial hackathon schemas that allowed duplicate membership rows.
WITH ranked_members AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY team_id, user_id
      ORDER BY
        CASE WHEN role = 'leader' THEN 0 ELSE 1 END,
        joined_at ASC,
        id ASC
    ) AS row_num
  FROM public.hackathon_team_members
)
DELETE FROM public.hackathon_team_members m
USING ranked_members r
WHERE m.id = r.id
  AND r.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS hackathon_team_members_team_user_unique
  ON public.hackathon_team_members(team_id, user_id);

-- Realtime powers immediate team/invite/project updates in the hackathon UI.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_teams;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_team_members;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_team_invites;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_projects;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_scores;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_photos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 1. Create/update the published event
INSERT INTO public.events (
  slug, code, name, venue, address, venue_image_url,
  start_time, end_time, timezone, status, capacity, admin_code, is_hackathon
)
VALUES (
  'calgary-hackathon-sait-may-2026',
  'SAIT2026',
  'Cursor Calgary Hackathon - SAIT',
  'Southern Alberta Institute of Technology',
  '1301 16 Ave NW, Calgary, AB T2M 0L4, Canada',
  '/nw-sait-heritage-hall-winter-730x485.jpg',
  '2026-05-23T14:00:00Z',   -- 8:00 AM MDT May 23
  '2026-05-24T21:30:00Z',   -- 3:30 PM MDT May 24
  'America/Edmonton',
  'published',
  150,
  LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0'),
  true
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
  is_hackathon = true,
  admin_code = COALESCE(public.events.admin_code, EXCLUDED.admin_code);

-- 2. Add it to the planning calendar and link it to the event row
INSERT INTO public.planned_events (
  title, event_date, end_date, start_time, end_time,
  venue, address, notes, confirmed, city, linked_event_id
)
SELECT
  'Cursor Calgary Hackathon - SAIT',
  '2026-05-23',
  '2026-05-24',
  '08:00',
  '15:30',
  e.venue,
  e.address,
  'Two-day SAIT hackathon. Teams of 3-4 build from a fixed prompt using Cursor; participants receive $50 credits.',
  true,
  'Calgary',
  e.id
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.planned_events pe
    WHERE pe.linked_event_id = e.id
       OR (pe.title = 'Cursor Calgary Hackathon - SAIT' AND pe.event_date = '2026-05-23')
  );

UPDATE public.planned_events pe
SET
  end_date = '2026-05-24',
  start_time = '08:00',
  end_time = '15:30',
  venue = e.venue,
  address = e.address,
  notes = 'Two-day SAIT hackathon. Teams of 3-4 build from a fixed prompt using Cursor; participants receive $50 credits.',
  confirmed = true,
  city = 'Calgary',
  linked_event_id = e.id,
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND (pe.linked_event_id = e.id OR (pe.title = 'Cursor Calgary Hackathon - SAIT' AND pe.event_date = '2026-05-23'));

-- 3. Configure hackathon mode
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
  NULL,                     -- team forming is open before the event; formal formation starts at 10:10 AM MDT Saturday
  '2026-05-23T16:40:00Z',   -- 10:40 AM MDT Saturday, team formation ends
  '2026-05-24T17:00:00Z',   -- 11:00 AM MDT Sunday, submission deadline
  '2026-05-24T18:15:00Z',   -- 12:15 PM MDT Sunday, final demos and judging start
  3,
  4,
  false,
  'Sample prompt....xxx etc.'
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.hackathon_settings hs
    WHERE hs.event_id = e.id
  );

UPDATE public.hackathon_settings hs
SET
  team_formation_enabled = true,
  team_formation_opens_at = NULL,
  team_formation_closes_at = '2026-05-23T16:40:00Z',
  submission_deadline = '2026-05-24T17:00:00Z',
  judging_starts_at = '2026-05-24T18:15:00Z',
  min_team_size = 3,
  max_team_size = 4,
  leaderboard_visible = false,
  prompt_text = COALESCE(NULLIF(BTRIM(hs.prompt_text), ''), 'Sample prompt....xxx etc.'),
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND hs.event_id = e.id;

-- Clear stale per-team locks for SAIT while formation is intentionally open.
UPDATE public.hackathon_teams ht
SET
  locked_at = NULL,
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND ht.event_id = e.id
  AND ht.locked_at IS NOT NULL;

-- 4. Replace the default meetup-style agenda with the hackathon agenda
DELETE FROM public.agenda_items
WHERE event_id = (SELECT id FROM public.events WHERE slug = 'calgary-hackathon-sait-may-2026');

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
      'Setup',
      'Organizers prepare the venue, check-in flow, and hackathon stations.',
      '2026-05-23T14:00:00Z',
      '2026-05-23T15:00:00Z',
      0
    ),
    (
      'Check-in',
      'Participants arrive at SAIT, check in, and get settled for the hackathon.',
      '2026-05-23T15:00:00Z',
      '2026-05-23T15:30:00Z',
      1
    ),
    (
      'Welcome & Framing',
      'Organizers welcome participants and frame the goals for the weekend.',
      '2026-05-23T15:30:00Z',
      '2026-05-23T15:40:00Z',
      2
    ),
    (
      'Day One Speaker',
      'Featured speaker session for day one of the hackathon.',
      '2026-05-23T15:40:00Z',
      '2026-05-23T16:10:00Z',
      3
    ),
    (
      'Team Formation',
      'Participants form teams of 3-4 before the prompt briefing begins.',
      '2026-05-23T16:10:00Z',
      '2026-05-23T16:40:00Z',
      4
    ),
    (
      'Prompt Briefing & Rules',
      'Organizers introduce the fixed challenge prompt, weekend rules, judging criteria, and Cursor credit flow.',
      '2026-05-23T16:40:00Z',
      '2026-05-23T17:00:00Z',
      5
    ),
    (
      'Building',
      'Teams build against the official prompt using Cursor.',
      '2026-05-23T17:00:00Z',
      '2026-05-23T21:45:00Z',
      6
    ),
    (
      'Closing Remarks',
      'Organizers close day one and share reminders for Sunday submissions.',
      '2026-05-23T21:45:00Z',
      '2026-05-23T22:00:00Z',
      7
    ),
    (
      'Setup',
      'Organizers prepare for day two demos, screening, awards, and networking.',
      '2026-05-24T15:45:00Z',
      '2026-05-24T16:00:00Z',
      8
    ),
    (
      'Participants Show Up',
      'Participants return to SAIT, prepare final materials, and get ready for screening.',
      '2026-05-24T16:00:00Z',
      '2026-05-24T18:15:00Z',
      9
    ),
    (
      'Submission Deadline',
      'Teams submit their project materials by 11:00 AM.',
      '2026-05-24T17:00:00Z',
      '2026-05-24T17:00:00Z',
      10
    ),
    (
      'AI Screening Round',
      'Organizers and judges review submissions and select finalists for live demos.',
      '2026-05-24T17:00:00Z',
      '2026-05-24T18:15:00Z',
      11
    ),
    (
      'Final Demos and Judging',
      'Finalist teams present live. Judges evaluate problem relevance, execution, product quality, and meaningful use of Cursor.',
      '2026-05-24T18:15:00Z',
      '2026-05-24T19:35:00Z',
      12
    ),
    (
      'Day Two Speaker',
      'Featured speaker session for day two of the hackathon.',
      '2026-05-24T19:35:00Z',
      '2026-05-24T19:50:00Z',
      13
    ),
    (
      'Awards and Recognition',
      'Winning teams are announced and recognized.',
      '2026-05-24T19:50:00Z',
      '2026-05-24T20:10:00Z',
      14
    ),
    (
      'Closing Remarks',
      'Organizers close the formal hackathon program.',
      '2026-05-24T20:10:00Z',
      '2026-05-24T20:20:00Z',
      15
    ),
    (
      'Networking Time',
      'Participants, organizers, and judges connect after the awards.',
      '2026-05-24T20:20:00Z',
      '2026-05-24T21:30:00Z',
      16
    )
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'calgary-hackathon-sait-may-2026';

-- 5. Pre-seed the hackathon competition (draft — admin activates it when ready)
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
  'Cursor Calgary Hackathon - SAIT Build Challenge',
  'Teams receive one fixed prompt from organizers and build a working solution with Cursor during the SAIT hackathon.',
  E'1. Teams must have 3-4 people.\n2. All teams build against the same official prompt.\n3. Projects must be built during the official hackathon build window.\n4. Submit the repo URL and any required demo materials before the 11:00 AM Sunday deadline.\n5. Finalists demo live on Sunday.\n6. Judging criteria: problem relevance, execution, product quality, and meaningful use of Cursor.',
  'draft',
  'judges',
  '2026-05-23T17:00:00Z',   -- 11:00 AM MDT Saturday, building starts
  '2026-05-24T17:00:00Z'    -- 11:00 AM MDT Sunday, submission deadline
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.event_id = e.id
      AND c.title = 'Cursor Calgary Hackathon - SAIT Build Challenge'
  );

UPDATE public.competitions c
SET
  description = 'Teams receive one fixed prompt from organizers and build a working solution with Cursor during the SAIT hackathon.',
  rules = E'1. Teams must have 3-4 people.\n2. All teams build against the same official prompt.\n3. Projects must be built during the official hackathon build window.\n4. Submit the repo URL and any required demo materials before the 11:00 AM Sunday deadline.\n5. Finalists demo live on Sunday.\n6. Judging criteria: problem relevance, execution, product quality, and meaningful use of Cursor.',
  starts_at = '2026-05-23T17:00:00Z',
  ends_at = '2026-05-24T17:00:00Z'
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND c.event_id = e.id
  AND c.title = 'Cursor Calgary Hackathon - SAIT Build Challenge';

-- 6. Make SAIT selectable/active from attendee entry points immediately after seeding
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('active_event_slug', 'calgary-hackathon-sait-may-2026', NOW())
ON CONFLICT (key) DO UPDATE
SET
  value = 'calgary-hackathon-sait-may-2026',
  updated_at = NOW();
