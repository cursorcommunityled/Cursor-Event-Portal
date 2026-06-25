-- Turn on attendee-facing AI screening scores for the Calgary June 2026 hackathon.
-- The Leaderboard tab on the attendee hub reads pass6 synthesis when this is true.

UPDATE public.hackathon_settings hs
SET
  ai_scores_visible = true,
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-june-2026'
  AND hs.event_id = e.id;

NOTIFY pgrst, 'reload schema';
