DO $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Get the SAIT May 2026 event ID
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping mentor insertion.';
    RETURN;
  END IF;

  -- Insert initial mentors if they don't exist
  IF NOT EXISTS (SELECT 1 FROM public.mentors WHERE event_id = v_event_id AND name = 'Oguzhan Dogru') THEN
  INSERT INTO public.mentors (event_id, name, company, title, mentorship_mode, display_order, bio)
  VALUES
    (v_event_id, 'Oguzhan Dogru', 'University of Alberta', 'Judge & Mentor', 'in_person', 10, 'Excited to see what you build! Available to help with technical architecture, product strategy, and pitching.'),
    (v_event_id, 'Jia Ming Huang', NULL, 'Judge & Mentor', 'in_person', 20, 'Excited to see what you build! Available to help with technical architecture, product strategy, and pitching.'),
    (v_event_id, 'Cal Leung', NULL, 'Judge', 'in_person', 30, 'Looking forward to reviewing your innovative solutions and providing feedback on your projects.'),
    (v_event_id, 'Audrey Aui Yong', 'Tsuin AI', 'Judge', 'in_person', 40, 'Looking forward to reviewing your innovative solutions and providing feedback on your projects.'),
    (v_event_id, 'Simon Loewen', 'New Era Intelligence', 'Judge & Mentor', 'in_person', 50, 'Excited to see what you build! Available to help with technical architecture, product strategy, and pitching.'),
    (v_event_id, 'Alex Young', NULL, 'Mentor', 'in_person', 60, 'Here to help you unblock technical challenges and refine your hackathon project.'),
    (v_event_id, 'Trystan Keller', 'Saleslink Strategies', 'Judge', 'in_person', 70, 'Looking forward to reviewing your innovative solutions and providing feedback on your projects.'),
    (v_event_id, 'David Lynch', 'Openhouse.ai', 'Mentor', 'in_person', 80, 'Here to help you unblock technical challenges and refine your hackathon project.'),
    (v_event_id, 'Anvil Palamattam', 'Google', 'Judge & Mentor', 'in_person', 90, 'Excited to see what you build! Available to help with technical architecture, product strategy, and pitching.'),
    (v_event_id, 'Suprita Shankar', NULL, 'Judge & Mentor', 'virtual', 100, 'Excited to see what you build! Available to help with technical architecture, product strategy, and pitching.'),
    (v_event_id, 'Riti Nawroz', NULL, 'Mentor', 'in_person', 110, 'Here to help you unblock technical challenges and refine your hackathon project.'),
    (v_event_id, 'Fatema C (HerAI)', 'University of Calgary', 'Mentor', 'in_person', 120, 'Here to help you unblock technical challenges and refine your hackathon project.'),
    (v_event_id, 'Aditya Thakur', 'Salesforce', 'Mentor', 'in_person', 130, 'Here to help you unblock technical challenges and refine your hackathon project.');
  END IF;

END $$;
