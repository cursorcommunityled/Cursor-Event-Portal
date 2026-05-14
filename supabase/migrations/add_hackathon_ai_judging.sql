-- AI judging pipeline for hackathon projects
-- Stores per-team, per-pass analysis results + screenshot URLs

-- ── 1. Screenshots per hackathon project ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_project_screenshots (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  file_url   text        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hackathon_screenshots_team
  ON hackathon_project_screenshots(team_id, sort_order);

-- ── 2. Add pitch_text to hackathon_projects ───────────────────────────────────
ALTER TABLE hackathon_projects
  ADD COLUMN IF NOT EXISTS pitch_text text;

-- ── 3. AI analysis passes (one row per team, per pass) ───────────────────────
CREATE TABLE IF NOT EXISTS hackathon_ai_analyses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pass_name  text        NOT NULL,
  -- pass1_repo | pass2_code | pass3_innovation | pass4_visual | pass5_pool | pass6_synthesis
  model_used text,
  result     jsonb,
  status     text        NOT NULL DEFAULT 'pending',
  -- pending | running | complete | error
  error      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, pass_name)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_ai_analyses_team
  ON hackathon_ai_analyses(team_id, pass_name);
CREATE INDEX IF NOT EXISTS idx_hackathon_ai_analyses_event
  ON hackathon_ai_analyses(event_id, status);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE hackathon_project_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_ai_analyses         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hackathon_project_screenshots"
  ON hackathon_project_screenshots FOR SELECT USING (true);
CREATE POLICY "Service write hackathon_project_screenshots"
  ON hackathon_project_screenshots FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read hackathon_ai_analyses"
  ON hackathon_ai_analyses FOR SELECT USING (true);
CREATE POLICY "Service write hackathon_ai_analyses"
  ON hackathon_ai_analyses FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Realtime (progress updates) ───────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_ai_analyses;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_project_screenshots;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
