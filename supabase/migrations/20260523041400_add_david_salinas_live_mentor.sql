DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping David Salinas mentor upsert.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET
    mentorship_mode = 'in_person',
    in_person_location = NULL,
    in_person_schedule = NULL,
    is_mentor = true,
    is_judge = true,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name = 'Cal Leung';

  IF EXISTS (
    SELECT 1
    FROM public.mentors
    WHERE event_id = v_event_id
      AND name = 'David Salinas R'
  ) THEN
    UPDATE public.mentors
    SET
      company = 'Stealth Mode',
      title = 'Founder & Product Builder',
      mentorship_mode = 'in_person',
      in_person_location = NULL,
      in_person_schedule = NULL,
      display_order = 150,
      bio = 'Founder and product builder focused on AI, startups, conversational commerce, and community-led growth. David has led product and community work across Rappi, Zubale, Soy Startup Latam, and large-scale digital products in Latin America, bringing a strong product strategy, go-to-market, execution, and pitch-coaching lens for hackathon teams.',
      photo_url = '/avatars/hackathon/sait-may-2026/david-salinas-r.jpeg',
      meet_link = NULL,
      is_mentor = true,
      is_judge = false,
      updated_at = NOW()
    WHERE event_id = v_event_id
      AND name = 'David Salinas R';
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
      meet_link,
      is_mentor,
      is_judge
    )
    VALUES (
      v_event_id,
      'David Salinas R',
      'Stealth Mode',
      'Founder & Product Builder',
      'in_person',
      150,
      'Founder and product builder focused on AI, startups, conversational commerce, and community-led growth. David has led product and community work across Rappi, Zubale, Soy Startup Latam, and large-scale digital products in Latin America, bringing a strong product strategy, go-to-market, execution, and pitch-coaching lens for hackathon teams.',
      '/avatars/hackathon/sait-may-2026/david-salinas-r.jpeg',
      NULL,
      true,
      false
    );
  END IF;
END $$;
