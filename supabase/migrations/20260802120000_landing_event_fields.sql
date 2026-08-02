-- Landing page event fields: publish an event once and it appears on cursorcalgary.com.
-- Safe to run multiple times.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS luma_url TEXT,
  ADD COLUMN IF NOT EXISTS landing_description TEXT,
  ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.planned_events
  ADD COLUMN IF NOT EXISTS luma_url TEXT;

COMMENT ON COLUMN public.events.luma_url IS 'Public Luma registration URL shown on cursorcalgary.com';
COMMENT ON COLUMN public.events.landing_description IS 'Short blurb for the Event Links section on the landing page';
COMMENT ON COLUMN public.events.show_on_landing IS 'When true and status is published/active/completed, list on the public site';
COMMENT ON COLUMN public.planned_events.luma_url IS 'Luma URL captured on calendar import; copied to events on promote';

-- Backfill known Calgary events so the site stays complete after switching off hardcoded-only listings.
UPDATE public.events SET
  luma_url = 'https://luma.com/6z1eyz1l',
  landing_description = 'A daytime Cafe Cursor co-working event at HOUSE 831. Bring your laptop, work alongside local Cursor users, and drop in for building, coffee, and community.',
  show_on_landing = true
WHERE slug = 'cafe-cursor-calgary-aug-2026';

UPDATE public.events SET
  luma_url = 'https://luma.com/y6o5mr37',
  landing_description = 'Sponsored by ZayZoon. Bring your laptop for speakers, a micro-hackathon build session, demos, and networking.',
  show_on_landing = true
WHERE slug = 'calgary-july-2026';

UPDATE public.events SET
  luma_url = 'https://luma.com/cursor-t2wq',
  landing_description = 'Hosted at ZayZoon. Bring your laptop for speakers, a hands-on build session, demos, and networking.',
  show_on_landing = true
WHERE slug = 'calgary-june-2026';

UPDATE public.events SET
  luma_url = 'https://luma.com/e4l2gbj2',
  show_on_landing = true
WHERE slug = 'calgary-hackathon-sait-may-2026';

UPDATE public.events SET
  luma_url = 'https://luma.com/kjchw3e3',
  show_on_landing = true
WHERE slug = 'calgary-may-2026';

UPDATE public.events SET
  luma_url = 'https://lu.ma/onlcm9o9',
  show_on_landing = true
WHERE slug IN ('calgary-apr-2026', 'cursor-meetup-calgary-april');

UPDATE public.planned_events pe
SET luma_url = e.luma_url
FROM public.events e
WHERE pe.linked_event_id = e.id
  AND e.luma_url IS NOT NULL
  AND (pe.luma_url IS NULL OR pe.luma_url = '');
