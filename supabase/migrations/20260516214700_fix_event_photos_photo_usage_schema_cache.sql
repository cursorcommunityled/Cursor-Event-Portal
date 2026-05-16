-- Ensure deployed databases and PostgREST agree that event photos support usage types.
DO $$
BEGIN
  IF to_regclass('public.event_photos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.event_photos
    ADD COLUMN IF NOT EXISTS photo_usage TEXT DEFAULT 'event_gallery';

  UPDATE public.event_photos
  SET photo_usage = 'hackathon_team_icon'
  WHERE storage_path LIKE '%/hackathon-team-icons/%'
     OR caption LIKE 'Team icon:%';

  UPDATE public.event_photos
  SET photo_usage = 'event_gallery'
  WHERE photo_usage IS NULL
     OR photo_usage NOT IN ('event_gallery', 'hackathon_team_icon');

  ALTER TABLE public.event_photos
    ALTER COLUMN photo_usage SET DEFAULT 'event_gallery',
    ALTER COLUMN photo_usage SET NOT NULL;

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

-- Supabase/PostgREST can keep serving an old schema after DDL until this reloads.
NOTIFY pgrst, 'reload schema';
