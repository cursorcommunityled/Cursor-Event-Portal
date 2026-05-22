CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping virtual mentor booking setup.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET
    mentorship_mode = 'virtual',
    in_person_location = NULL,
    in_person_schedule = NULL,
    is_mentor = true,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name IN ('Suprita Shankar', 'Aditya Thakur', 'Kanis Patel');

  UPDATE public.demo_signup_settings
  SET
    is_enabled = true,
    opens_at = '2026-05-23T16:30:00Z',
    closes_at = '2026-05-23T21:00:00Z',
    updated_at = NOW()
  WHERE event_id = v_event_id;

  INSERT INTO public.demo_signup_settings (
    event_id,
    is_enabled,
    speaker_name,
    banner_image_url,
    opens_at,
    closes_at
  )
  SELECT
    v_event_id,
    true,
    NULL,
    NULL,
    '2026-05-23T16:30:00Z',
    '2026-05-23T21:00:00Z'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.demo_signup_settings
    WHERE event_id = v_event_id
  );

  INSERT INTO public.demo_slots (
    event_id,
    starts_at,
    ends_at,
    capacity,
    title,
    host_name,
    description,
    location,
    session_type,
    mentor_id
  )
  SELECT
    v_event_id,
    slot_start,
    slot_start + INTERVAL '5 minutes',
    2,
    'Virtual Mentor Session',
    mentor.name,
    'Book a focused 5-minute virtual mentor session.',
    'Virtual',
    'mentor',
    mentor.id
  FROM public.mentors AS mentor
  CROSS JOIN (
    VALUES
      ('2026-05-23T17:00:00Z'::timestamptz, '2026-05-23T19:00:00Z'::timestamptz),
      ('2026-05-23T20:00:00Z'::timestamptz, '2026-05-23T21:00:00Z'::timestamptz)
  ) AS booking_window(window_start, window_end)
  CROSS JOIN LATERAL generate_series(
    booking_window.window_start,
    booking_window.window_end - INTERVAL '5 minutes',
    INTERVAL '5 minutes'
  ) AS slot_start
  WHERE mentor.event_id = v_event_id
    AND mentor.name IN ('Suprita Shankar', 'Aditya Thakur', 'Kanis Patel')
    AND NOT EXISTS (
      SELECT 1
      FROM public.demo_slots AS existing_slot
      WHERE existing_slot.event_id = v_event_id
        AND existing_slot.mentor_id = mentor.id
        AND existing_slot.starts_at = slot_start
    );
END $$;

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_emails (email)
VALUES ('aditya.thakur@salesforce.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.users
SET
  role = 'admin',
  name = COALESCE(NULLIF(name, ''), 'Aditya Thakur'),
  updated_at = NOW()
WHERE LOWER(email) = 'aditya.thakur@salesforce.com';

WITH admin_user(email, name) AS (
  VALUES ('aditya.thakur@salesforce.com', 'Aditya Thakur')
)
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT
  COALESCE(auth_user.id, gen_random_uuid()),
  admin_user.email,
  admin_user.name,
  'admin',
  NOW(),
  NOW()
FROM admin_user
LEFT JOIN auth.users AS auth_user
  ON LOWER(auth_user.email) = admin_user.email
WHERE NOT EXISTS (
    SELECT 1
    FROM public.users AS existing_user
    WHERE LOWER(existing_user.email) = admin_user.email
  )
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
  updated_at = NOW();
