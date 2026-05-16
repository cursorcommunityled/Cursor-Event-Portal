-- Add an attendee-facing prompt to hackathon settings.
ALTER TABLE IF EXISTS public.hackathon_settings
  ADD COLUMN IF NOT EXISTS prompt_text TEXT NOT NULL DEFAULT 'Sample prompt....xxx etc.';

DO $$
BEGIN
  IF to_regclass('public.hackathon_settings') IS NOT NULL THEN
    UPDATE public.hackathon_settings
    SET prompt_text = 'Sample prompt....xxx etc.'
    WHERE NULLIF(BTRIM(prompt_text), '') IS NULL;
  END IF;
END $$;
