DELETE FROM public.agenda_items
WHERE event_id = (
  SELECT id FROM public.events WHERE slug = 'cafe-cursor-calgary-aug-2026'
);

INSERT INTO public.agenda_items (event_id, title, description, start_time, end_time, sort_order)
SELECT
  e.id,
  v.title,
  v.description,
  v.start_time::timestamptz,
  v.end_time::timestamptz,
  v.sort_order
FROM public.events e
CROSS JOIN (
  VALUES
    (
      'Check-in',
      'Arrive with your Luma registration, grab a spot, and settle in. Drop-in guests welcome anytime 9:00am-5:00pm.',
      '2026-08-02T15:00:00Z',
      '2026-08-02T15:15:00Z',
      0
    ),
    (
      'Morning Co-working',
      'For the Co-working 9:00am-1:00pm ticket. Bring your laptop, build, and swap Cursor workflows. Free coffee and patio open.',
      '2026-08-02T15:15:00Z',
      '2026-08-02T19:00:00Z',
      1
    ),
    (
      'Afternoon Co-working',
      'For the Co-working 1:00pm-5:00pm ticket. Open build time, casual help, and networking. Drop-in guests welcome through 5:00pm.',
      '2026-08-02T19:00:00Z',
      '2026-08-02T23:00:00Z',
      2
    )
) AS v(title, description, start_time, end_time, sort_order)
WHERE e.slug = 'cafe-cursor-calgary-aug-2026';
