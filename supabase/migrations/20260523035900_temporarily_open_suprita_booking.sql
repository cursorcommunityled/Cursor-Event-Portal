DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping temporary booking window update.';
    RETURN;
  END IF;

  UPDATE public.demo_signup_settings
  SET
    is_enabled = true,
    opens_at = '2026-05-23T03:55:00Z',
    updated_at = NOW()
  WHERE event_id = v_event_id;
END $$;
