-- June 24 2026 micro-hackathon run of show.
-- Agenda 5:30 PM -> 9:00 PM MDT (UTC-6); stored as UTC. Safe to re-run.

-- 1) Event window ends at 9:00 PM (start already 5:30 PM).
UPDATE public.events
SET end_time = '2026-06-25T03:00:00Z'   -- 9:00 PM MDT June 24
WHERE slug = 'calgary-june-2026';

-- 2) Replace the agenda.
DELETE FROM public.agenda_items
WHERE event_id = (SELECT id FROM public.events WHERE slug = 'calgary-june-2026');

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT e.id, v.title, v.description, v.start_time::timestamptz, v.end_time::timestamptz, v.sort_order
FROM public.events e
CROSS JOIN (
  VALUES
    ('Arrivals & Networking', 'Get settled in, grab a seat, and meet other builders.',                              '2026-06-24T23:30:00Z', '2026-06-25T00:00:00Z', 0),
    ('Intro to Cursor',       'Quick overview of Cursor and how to get the most out of tonight.',                   '2026-06-25T00:00:00Z', '2026-06-25T00:10:00Z', 1),
    ('Demo',                  'Live demo to kick things off.',                                                     '2026-06-25T00:10:00Z', '2026-06-25T00:20:00Z', 2),
    ('microHACKATHON!!!',     'Form a team (1-4), build with Cursor, and ship a working demo before the deadline.', '2026-06-25T00:20:00Z', '2026-06-25T02:20:00Z', 3),
    ('AI Judging Round',      'AI screening scores every submitted project to pick the finalists.',                 '2026-06-25T02:20:00Z', '2026-06-25T02:30:00Z', 4),
    ('Finalists Demos',       'Top teams demo their builds live.',                                                 '2026-06-25T02:30:00Z', '2026-06-25T02:50:00Z', 5),
    ('Winners Announced',     'Winners revealed and celebrated — stick around to keep networking.',                 '2026-06-25T02:50:00Z', '2026-06-25T03:00:00Z', 6)
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'calgary-june-2026';

NOTIFY pgrst, 'reload schema';
