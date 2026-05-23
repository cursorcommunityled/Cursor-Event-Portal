DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping SAIT cursor credit setup.';
    RETURN;
  END IF;

  IF to_regclass('public.cursor_credits') IS NULL THEN
    RAISE NOTICE 'cursor_credits table not found, skipping SAIT cursor credit setup.';
    RETURN;
  END IF;

  UPDATE public.events
  SET is_hackathon = true
  WHERE id = v_event_id;

  UPDATE public.cursor_credits
  SET amount_usd = 50
  WHERE event_id = v_event_id
    AND amount_usd IS DISTINCT FROM 50;
END $$;
