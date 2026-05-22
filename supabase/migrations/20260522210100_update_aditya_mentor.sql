DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping Aditya Thakur mentor update.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mentors
    WHERE event_id = v_event_id
      AND name = 'Aditya Thakur'
  ) THEN
    UPDATE public.mentors
    SET
      company = 'Salesforce',
      title = 'Sr. Director of Software Engineering',
      mentorship_mode = 'in_person',
      display_order = 130,
      bio = 'Senior Director of Software Engineering at Salesforce leading enterprise AI, platform modernization, developer productivity, engineering excellence, and mission-critical Quote-to-Cash systems. Aditya brings deep experience in enterprise architecture, AI governance, cloud platforms, compliance, and scaling high-performing engineering teams.',
      photo_url = '/avatars/hackathon/sait-may-2026/aditya-thakur.jpg',
      is_mentor = true,
      is_judge = false,
      updated_at = NOW()
    WHERE event_id = v_event_id
      AND name = 'Aditya Thakur';
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
      'Aditya Thakur',
      'Salesforce',
      'Sr. Director of Software Engineering',
      'in_person',
      130,
      'Senior Director of Software Engineering at Salesforce leading enterprise AI, platform modernization, developer productivity, engineering excellence, and mission-critical Quote-to-Cash systems. Aditya brings deep experience in enterprise architecture, AI governance, cloud platforms, compliance, and scaling high-performing engineering teams.',
      '/avatars/hackathon/sait-may-2026/aditya-thakur.jpg',
      true,
      false
    );
  END IF;
END $$;
