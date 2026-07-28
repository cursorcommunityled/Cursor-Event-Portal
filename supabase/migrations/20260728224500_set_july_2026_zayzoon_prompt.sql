-- Set the July 29 micro-hackathon challenge prompt (ZayZoon daily-earner theme).
-- Safe to re-run.

UPDATE public.hackathon_settings hs
SET
  prompt_text = E'Build something that goes beyond the typical budget feature of money in / money out — imagine what a worker who earns daily would actually find valuable when managing their day-to-day earnings in a budgeting tool.',
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-july-2026'
  AND hs.event_id = e.id;
