-- Separate public event-gallery photos from hackathon team profile icons.
-- Some environments have non-timestamped legacy migrations, so this migration
-- may be evaluated before event_photos exists. The base create migration also
-- includes this column for fresh databases.
DO $$
BEGIN
  IF to_regclass('public.event_photos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.event_photos
    ADD COLUMN IF NOT EXISTS photo_usage TEXT NOT NULL DEFAULT 'event_gallery';

  UPDATE public.event_photos
  SET photo_usage = 'hackathon_team_icon'
  WHERE storage_path LIKE '%/hackathon-team-icons/%'
     OR caption LIKE 'Team icon:%';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_photos_photo_usage_check'
      AND conrelid = 'public.event_photos'::regclass
  ) THEN
    ALTER TABLE public.event_photos
      ADD CONSTRAINT event_photos_photo_usage_check
      CHECK (photo_usage IN ('event_gallery', 'hackathon_team_icon'));
  END IF;

  CREATE INDEX IF NOT EXISTS idx_event_photos_event_usage_status
    ON public.event_photos(event_id, photo_usage, status);
END $$;
