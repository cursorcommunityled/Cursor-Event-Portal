DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping team formation unlock.';
    RETURN;
  END IF;

  IF to_regclass('public.hackathon_settings') IS NULL THEN
    RAISE NOTICE 'hackathon_settings table not found, skipping team formation unlock.';
    RETURN;
  END IF;

  INSERT INTO public.hackathon_settings (
    event_id,
    team_formation_enabled,
    team_formation_opens_at,
    team_formation_closes_at
  )
  VALUES (
    v_event_id,
    true,
    NULL,
    NULL
  )
  ON CONFLICT (event_id) DO UPDATE
  SET
    team_formation_enabled = true,
    team_formation_opens_at = NULL,
    team_formation_closes_at = NULL,
    updated_at = NOW();

  IF to_regclass('public.hackathon_teams') IS NOT NULL THEN
    UPDATE public.hackathon_teams
    SET
      locked_at = NULL,
      updated_at = NOW()
    WHERE event_id = v_event_id
      AND locked_at IS NOT NULL;
  END IF;
END $$;
