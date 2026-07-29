-- Volunteer-to-present pool + admin-picked presentation teams.
-- Safe to run multiple times.

ALTER TABLE public.hackathon_teams
  ADD COLUMN IF NOT EXISTS volunteered_to_present_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS volunteered_to_present_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hackathon_teams_volunteered_to_present
  ON public.hackathon_teams (event_id)
  WHERE volunteered_to_present_at IS NOT NULL;

ALTER TABLE public.hackathon_settings
  ADD COLUMN IF NOT EXISTS presentation_team_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS presentation_picked_at TIMESTAMPTZ;
