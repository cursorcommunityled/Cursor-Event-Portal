-- Public SAIT hackathon start should reflect attendee arrival at 9:00 AM MDT.
-- Organizer setup remains scheduled before attendee check-in.

UPDATE public.events
SET start_time = '2026-05-23T15:00:00Z'
WHERE slug = 'calgary-hackathon-sait-may-2026';

UPDATE public.planned_events pe
SET
  start_time = '09:00',
  updated_at = NOW()
FROM public.events e
WHERE e.slug = 'calgary-hackathon-sait-may-2026'
  AND (
    pe.linked_event_id = e.id
    OR (pe.title = 'Cursor Calgary Hackathon - SAIT' AND pe.event_date = '2026-05-23')
  );
