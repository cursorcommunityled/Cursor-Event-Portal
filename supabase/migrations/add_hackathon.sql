-- ─── Hackathon Feature ───────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.
-- Adds hackathon mode: teams, invites, projects, judging scores.

-- ── 1. Add hackathon mode flag to events ─────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_hackathon boolean NOT NULL DEFAULT false;

-- ── 2. Hackathon Settings (one row per event) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_settings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_formation_enabled    boolean     NOT NULL DEFAULT true,  -- manual on/off switch; overrides timer
  team_formation_opens_at   timestamptz,
  team_formation_closes_at  timestamptz,
  submission_deadline       timestamptz,
  judging_starts_at         timestamptz,
  min_team_size             int         NOT NULL DEFAULT 2,
  max_team_size             int         NOT NULL DEFAULT 4,
  leaderboard_visible       boolean     NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

-- ── 3. Teams ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_by  uuid        NOT NULL REFERENCES users(id),
  icon_photo_id uuid,
  locked_at   timestamptz,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hackathon_teams
  ADD COLUMN IF NOT EXISTS icon_photo_id uuid;

CREATE INDEX IF NOT EXISTS idx_hackathon_teams_icon_photo_id
  ON hackathon_teams(icon_photo_id);

-- ── 4. Team Members ───────────────────────────────────────────────────────────
-- One-team-per-event is enforced at the application level (server actions check
-- before inserting). The UNIQUE(team_id, user_id) prevents duplicate rows.
CREATE TABLE IF NOT EXISTS hackathon_team_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid        NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES users(id),
  role      text        NOT NULL DEFAULT 'member',  -- 'leader' | 'member'
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ── 5. Team Invites ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_team_invites (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid        NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  event_id        uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  invited_by      uuid        NOT NULL REFERENCES users(id),
  invited_user_id uuid        NOT NULL REFERENCES users(id),
  status          text        NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'declined'
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate pending invites for the same team+person combo
CREATE UNIQUE INDEX IF NOT EXISTS hackathon_team_invites_pending_unique
  ON hackathon_team_invites(team_id, invited_user_id)
  WHERE status = 'pending';

-- ── 6. Projects ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid        NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  repo_url      text,
  demo_url      text,
  video_url     text,
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- ── 7. Scores ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_scores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid        NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  judge_id      uuid        NOT NULL REFERENCES users(id),
  innovation    int         CHECK (innovation BETWEEN 0 AND 10),
  execution     int         CHECK (execution BETWEEN 0 AND 10),
  presentation  int         CHECK (presentation BETWEEN 0 AND 10),
  ux_polish     int         CHECK (ux_polish BETWEEN 0 AND 10),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, judge_id)
);

-- ── 8. Row-Level Security ─────────────────────────────────────────────────────
ALTER TABLE hackathon_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_scores       ENABLE ROW LEVEL SECURITY;

-- Public read; all writes go through service-role server actions
CREATE POLICY "Public read hackathon_settings"     ON hackathon_settings     FOR SELECT USING (true);
CREATE POLICY "Public read hackathon_teams"        ON hackathon_teams        FOR SELECT USING (true);
CREATE POLICY "Public read hackathon_team_members" ON hackathon_team_members FOR SELECT USING (true);
CREATE POLICY "Public read hackathon_team_invites" ON hackathon_team_invites FOR SELECT USING (true);
CREATE POLICY "Public read hackathon_projects"     ON hackathon_projects     FOR SELECT USING (true);
CREATE POLICY "Public read hackathon_scores"       ON hackathon_scores       FOR SELECT USING (true);

-- ── 9. Realtime ───────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_team_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE event_photos;
