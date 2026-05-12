-- Flexible final-round judging for competition-backed hackathon projects.

DO $$
BEGIN
  IF to_regclass('public.events') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regclass('public.competitions') IS NULL
     OR to_regclass('public.competition_entries') IS NULL THEN
    RAISE EXCEPTION
      'competition judging requires the base event, user, competition, and competition_entries tables. Apply earlier portal migrations, especially 20260201_competitions.sql, before this migration.';
  END IF;
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
