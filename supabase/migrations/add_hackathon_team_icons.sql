-- Allow hackathon teams to nominate an approved event photo as their team icon.
ALTER TABLE public.hackathon_teams
  ADD COLUMN IF NOT EXISTS icon_photo_id UUID;

CREATE INDEX IF NOT EXISTS idx_hackathon_teams_icon_photo_id
  ON public.hackathon_teams(icon_photo_id);

-- Team icon approvals update event_photos, so include it in realtime refreshes.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_photos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
