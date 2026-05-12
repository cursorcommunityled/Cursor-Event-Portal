-- Flexible final-round judging for competition-backed hackathon projects.
-- This migration can be applied on databases that have not yet run the older
-- competition migrations by first ensuring the base competition tables exist.

DO $$
BEGIN
  IF to_regclass('public.events') IS NULL OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION
      'competition judging requires the base events and users tables before competition tables can be created.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  voting_mode TEXT NOT NULL DEFAULT 'group',
  winner_entry_id UUID,
  winner_method TEXT CHECK (winner_method IN ('auto', 'manual')),
  top3_entry_ids UUID[] DEFAULT '{}',
  group_winner_entry_id UUID,
  admin_winner_entry_id UUID,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_entries INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competition_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.competition_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.competition_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 1 CHECK (score >= 1 AND score <= 5),
  is_judge BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competition_id, user_id, entry_id)
);

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS top3_entry_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS group_winner_entry_id UUID,
  ADD COLUMN IF NOT EXISTS admin_winner_entry_id UUID;

ALTER TABLE public.competition_entries
  ADD COLUMN IF NOT EXISTS preview_image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN public.competition_entries.preview_image_url IS 'URL to screenshot/image for voting display and big-screen showcase';
COMMENT ON COLUMN public.competition_entries.video_url IS 'Optional demo video URL (e.g. YouTube, Vimeo)';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'competitions_voting_mode_check'
      AND conrelid = 'public.competitions'::regclass
  ) THEN
    ALTER TABLE public.competitions DROP CONSTRAINT competitions_voting_mode_check;
  END IF;

  ALTER TABLE public.competitions
    ADD CONSTRAINT competitions_voting_mode_check
    CHECK (voting_mode IN ('group', 'judges', 'both', 'top3'));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitions_winner_entry_id_fkey'
      AND conrelid = 'public.competitions'::regclass
  ) THEN
    ALTER TABLE public.competitions
      ADD CONSTRAINT competitions_winner_entry_id_fkey
      FOREIGN KEY (winner_entry_id) REFERENCES public.competition_entries(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitions_group_winner_entry_id_fkey'
      AND conrelid = 'public.competitions'::regclass
  ) THEN
    ALTER TABLE public.competitions
      ADD CONSTRAINT competitions_group_winner_entry_id_fkey
      FOREIGN KEY (group_winner_entry_id) REFERENCES public.competition_entries(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitions_admin_winner_entry_id_fkey'
      AND conrelid = 'public.competitions'::regclass
  ) THEN
    ALTER TABLE public.competitions
      ADD CONSTRAINT competitions_admin_winner_entry_id_fkey
      FOREIGN KEY (admin_winner_entry_id) REFERENCES public.competition_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read competitions" ON public.competitions;
CREATE POLICY "Public read competitions" ON public.competitions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service write competitions" ON public.competitions;
CREATE POLICY "Service write competitions" ON public.competitions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read competition_entries" ON public.competition_entries;
CREATE POLICY "Public read competition_entries" ON public.competition_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service write competition_entries" ON public.competition_entries;
CREATE POLICY "Service write competition_entries" ON public.competition_entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read competition_votes" ON public.competition_votes;
CREATE POLICY "Public read competition_votes" ON public.competition_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service write competition_votes" ON public.competition_votes;
CREATE POLICY "Service write competition_votes" ON public.competition_votes FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.competitions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_entries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_votes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS competition_finalist_entries (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  competition_id uuid        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  entry_id       uuid        NOT NULL REFERENCES public.competition_entries(id) ON DELETE CASCADE,
  position       int         NOT NULL DEFAULT 0 CHECK (position >= 0),
  selected_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  selected_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, entry_id)
);

CREATE TABLE IF NOT EXISTS competition_judging_criteria (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  competition_id uuid        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  slug           text        NOT NULL,
  label          text        NOT NULL,
  description    text,
  max_points     numeric(6,2) NOT NULL CHECK (max_points > 0),
  weight         numeric(6,2) NOT NULL CHECK (weight > 0),
  sort_order     int         NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, slug)
);

CREATE TABLE IF NOT EXISTS competition_judging_scorecards (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  competition_id uuid        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  entry_id       uuid        NOT NULL REFERENCES public.competition_entries(id) ON DELETE CASCADE,
  judge_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes          text,
  submitted_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, entry_id, judge_id)
);

CREATE TABLE IF NOT EXISTS competition_judging_score_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id   uuid        NOT NULL REFERENCES competition_judging_scorecards(id) ON DELETE CASCADE,
  criterion_id   uuid        NOT NULL REFERENCES competition_judging_criteria(id) ON DELETE CASCADE,
  points         numeric(6,2) NOT NULL CHECK (points >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scorecard_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS competition_judging_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  competition_id uuid        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  entry_id       uuid        NOT NULL REFERENCES public.competition_entries(id) ON DELETE CASCADE,
  placement      int         NOT NULL CHECK (placement > 0),
  final_score    numeric(8,2) NOT NULL DEFAULT 0 CHECK (final_score >= 0),
  max_score      numeric(8,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  judge_count    int         NOT NULL DEFAULT 0 CHECK (judge_count >= 0),
  is_published   boolean     NOT NULL DEFAULT true,
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, placement),
  UNIQUE (competition_id, entry_id)
);

CREATE INDEX IF NOT EXISTS competition_finalist_entries_event_idx
  ON competition_finalist_entries(event_id, competition_id, position);
CREATE INDEX IF NOT EXISTS competition_judging_criteria_competition_idx
  ON competition_judging_criteria(competition_id, sort_order);
CREATE INDEX IF NOT EXISTS competition_judging_scorecards_competition_idx
  ON competition_judging_scorecards(competition_id, entry_id, judge_id);
CREATE INDEX IF NOT EXISTS competition_judging_score_items_scorecard_idx
  ON competition_judging_score_items(scorecard_id);
CREATE INDEX IF NOT EXISTS competition_judging_results_event_idx
  ON competition_judging_results(event_id, is_published, placement);

ALTER TABLE competition_finalist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_judging_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_judging_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_judging_score_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_judging_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read competition_finalist_entries" ON competition_finalist_entries;
CREATE POLICY "Public read competition_finalist_entries"
  ON competition_finalist_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write competition_finalist_entries" ON competition_finalist_entries;
CREATE POLICY "Service write competition_finalist_entries"
  ON competition_finalist_entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read competition_judging_criteria" ON competition_judging_criteria;
CREATE POLICY "Public read competition_judging_criteria"
  ON competition_judging_criteria FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write competition_judging_criteria" ON competition_judging_criteria;
CREATE POLICY "Service write competition_judging_criteria"
  ON competition_judging_criteria FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read competition_judging_scorecards" ON competition_judging_scorecards;
CREATE POLICY "Public read competition_judging_scorecards"
  ON competition_judging_scorecards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write competition_judging_scorecards" ON competition_judging_scorecards;
CREATE POLICY "Service write competition_judging_scorecards"
  ON competition_judging_scorecards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read competition_judging_score_items" ON competition_judging_score_items;
CREATE POLICY "Public read competition_judging_score_items"
  ON competition_judging_score_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write competition_judging_score_items" ON competition_judging_score_items;
CREATE POLICY "Service write competition_judging_score_items"
  ON competition_judging_score_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read competition_judging_results" ON competition_judging_results;
CREATE POLICY "Public read competition_judging_results"
  ON competition_judging_results FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Service write competition_judging_results" ON competition_judging_results;
CREATE POLICY "Service write competition_judging_results"
  ON competition_judging_results FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE competition_finalist_entries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE competition_judging_scorecards;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE competition_judging_score_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE competition_judging_results;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
