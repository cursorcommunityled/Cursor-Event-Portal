-- Per-event toggle for the hackathon attendee/admin "People" tab (mentors & judges).
-- Safe to run multiple times.

ALTER TABLE public.hackathon_settings
  ADD COLUMN IF NOT EXISTS people_tab_visible BOOLEAN NOT NULL DEFAULT true;

-- Hide People tab for Calgary June 2026 until mentors/judges are announced.
UPDATE public.hackathon_settings hs
SET people_tab_visible = false,
    updated_at = NOW()
FROM public.events e
WHERE hs.event_id = e.id
  AND e.slug = 'calgary-june-2026';

NOTIFY pgrst, 'reload schema';
