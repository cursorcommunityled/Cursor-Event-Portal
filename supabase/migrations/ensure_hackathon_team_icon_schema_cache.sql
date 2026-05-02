-- Ensure deployed databases and PostgREST agree that hackathon teams support icons.
ALTER TABLE public.hackathon_teams
  ADD COLUMN IF NOT EXISTS icon_photo_id UUID;

CREATE INDEX IF NOT EXISTS idx_hackathon_teams_icon_photo_id
  ON public.hackathon_teams(icon_photo_id);

-- Supabase/PostgREST can keep serving an old schema after DDL until this reloads.
NOTIFY pgrst, 'reload schema';
