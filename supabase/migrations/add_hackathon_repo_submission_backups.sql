-- Backup repo submissions so admins have a master fallback document even if
-- the primary project row fails to save or later drifts from the submitted URL.

CREATE TABLE IF NOT EXISTS public.hackathon_repo_submission_backups (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id               UUID        NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  submitted_by          UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  team_name             TEXT,
  project_name          TEXT,
  description           TEXT,
  repo_url              TEXT        NOT NULL,
  demo_url              TEXT,
  primary_project_saved BOOLEAN     NOT NULL DEFAULT FALSE,
  primary_project_error TEXT,
  submission_payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, team_id)
);

ALTER TABLE public.hackathon_repo_submission_backups
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_name TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS repo_url TEXT,
  ADD COLUMN IF NOT EXISTS demo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_project_saved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS primary_project_error TEXT,
  ADD COLUMN IF NOT EXISTS submission_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.hackathon_repo_submission_backups
  ALTER COLUMN repo_url SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hackathon_repo_submission_backups_event_team_unique
  ON public.hackathon_repo_submission_backups(event_id, team_id);

CREATE INDEX IF NOT EXISTS idx_hackathon_repo_submission_backups_event_updated
  ON public.hackathon_repo_submission_backups(event_id, updated_at DESC);

ALTER TABLE public.hackathon_repo_submission_backups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_repo_submission_backups;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
