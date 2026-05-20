-- Add optional attendee-editable profile fields for hackathon teammate discovery.

ALTER TABLE public.hackathon_profiles
  ADD COLUMN IF NOT EXISTS profile_bio text,
  ADD COLUMN IF NOT EXISTS project_interests text,
  ADD COLUMN IF NOT EXISTS collaboration_style text,
  ADD COLUMN IF NOT EXISTS looking_for_teammates text;
