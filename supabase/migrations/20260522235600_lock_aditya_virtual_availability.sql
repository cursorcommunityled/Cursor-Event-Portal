CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_event_id UUID;
  v_mentor_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping Aditya virtual availability update.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET
    mentorship_mode = 'virtual',
    in_person_location = NULL,
    in_person_schedule = NULL,
    meet_link = COALESCE(NULLIF(meet_link, ''), 'https://meet.google.com/suv-evqt-rjm'),
    is_mentor = true,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name = 'Aditya Thakur'
  RETURNING id INTO v_mentor_id;

  IF v_mentor_id IS NULL THEN
    RAISE NOTICE 'Aditya Thakur mentor row not found, skipping Aditya virtual availability update.';
    RETURN;
  END IF;

  -- Keep existing bookings intact, but remove unbooked Aditya slots outside
  -- the stated Saturday 11-1 and 2-3 MDT virtual availability windows.
  DELETE FROM public.demo_slots AS slot
  WHERE slot.event_id = v_event_id
    AND slot.mentor_id = v_mentor_id
    AND slot.starts_at >= '2026-05-23T15:00:00Z'
    AND slot.starts_at < '2026-05-24T17:00:00Z'
    AND NOT (
      (slot.starts_at >= '2026-05-23T17:00:00Z' AND slot.starts_at < '2026-05-23T19:00:00Z')
      OR
      (slot.starts_at >= '2026-05-23T20:00:00Z' AND slot.starts_at < '2026-05-23T21:00:00Z')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.demo_slot_signups AS signup
      WHERE signup.slot_id = slot.id
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
    slot_start + INTERVAL '30 minutes',
    1,
    'Virtual Mentor Session',
    'Aditya Thakur',
    'Book a focused 30-minute virtual mentor session. The Google Meet link unlocks when your session starts.',
    'Virtual',
    'mentor',
    v_mentor_id
  FROM (
    SELECT generated_slot AS slot_start
    FROM generate_series(
      '2026-05-23T17:00:00Z'::timestamptz,
      '2026-05-23T18:30:00Z'::timestamptz,
      INTERVAL '30 minutes'
    ) AS generated_slot
    UNION ALL
    SELECT generated_slot AS slot_start
    FROM generate_series(
      '2026-05-23T20:00:00Z'::timestamptz,
      '2026-05-23T20:30:00Z'::timestamptz,
      INTERVAL '30 minutes'
    ) AS generated_slot
  ) AS desired_slots
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.demo_slots AS existing_slot
    WHERE existing_slot.event_id = v_event_id
      AND existing_slot.mentor_id = v_mentor_id
      AND existing_slot.starts_at = desired_slots.slot_start
  );

  CREATE TABLE IF NOT EXISTS public.admin_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  INSERT INTO public.admin_emails (email)
  VALUES ('aditya.thakur@salesforce.com')
  ON CONFLICT (email) DO NOTHING;
END $$;
