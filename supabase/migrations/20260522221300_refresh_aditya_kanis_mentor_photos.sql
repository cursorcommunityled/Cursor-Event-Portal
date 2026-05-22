DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026';

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping Aditya/Kanis mentor photo refresh.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET photo_url = CASE name
    WHEN 'Aditya Thakur' THEN '/avatars/hackathon/sait-may-2026/aditya-thakur-20260522.png'
    WHEN 'Kanis Patel' THEN '/avatars/hackathon/sait-may-2026/kanis-patel-20260522.png'
    ELSE photo_url
  END
  WHERE event_id = v_event_id
    AND name IN ('Aditya Thakur', 'Kanis Patel');
END $$;
