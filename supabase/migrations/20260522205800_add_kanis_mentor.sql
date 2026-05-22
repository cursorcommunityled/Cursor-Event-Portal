DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping Kanis Patel mentor upsert.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mentors
    WHERE event_id = v_event_id
      AND name = 'Kanis Patel'
  ) THEN
    UPDATE public.mentors
    SET
      company = 'Founsi AI',
      title = 'Co-founder',
      mentorship_mode = 'in_person',
      display_order = 140,
      bio = 'Co-founder at Founsi AI, building AI systems that connect digital intelligence to the physical world. Kanis has led production ML and AI perception systems across computer vision, speech recognition, LLM integration, infrastructure, and zero-to-one product development.',
      photo_url = '/avatars/hackathon/sait-may-2026/kanis-patel.jpg',
      is_mentor = true,
      is_judge = false,
      updated_at = NOW()
    WHERE event_id = v_event_id
      AND name = 'Kanis Patel';
  ELSE
    INSERT INTO public.mentors (
      event_id,
      name,
      company,
      title,
      mentorship_mode,
      display_order,
      bio,
      photo_url,
      is_mentor,
      is_judge
    )
    VALUES (
      v_event_id,
      'Kanis Patel',
      'Founsi AI',
      'Co-founder',
      'in_person',
      140,
      'Co-founder at Founsi AI, building AI systems that connect digital intelligence to the physical world. Kanis has led production ML and AI perception systems across computer vision, speech recognition, LLM integration, infrastructure, and zero-to-one product development.',
      '/avatars/hackathon/sait-may-2026/kanis-patel.jpg',
      true,
      false
    );
  END IF;
END $$;
