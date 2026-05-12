-- Store an optional attendee-facing session banner per event.
-- Fresh databases also get this column from the legacy create migration.
DO $$
BEGIN
  IF to_regclass('public.demo_signup_settings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.demo_signup_settings
    ADD COLUMN IF NOT EXISTS banner_image_url TEXT;
END $$;
