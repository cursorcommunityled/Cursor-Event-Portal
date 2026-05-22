DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026';

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping Fatema mentor profile update.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET
    name = 'Fatema Chowdhury',
    title = 'President, HerAI & Full Stack Developer Intern',
    company = 'University of Calgary / AltaGas / HerAI',
    bio = 'Fatema is the current President of HerAI and a Computer Science student at University of Calgary with experience across both data and software development roles. She previously completed a data-focused internship at TC Energy and is currently working as a Full Stack Developer intern at AltaGas. Outside of tech, Fatema enjoys reading and baking, and is passionate about supporting students exploring technology, AI, and software development.',
    photo_url = '/avatars/hackathon/sait-may-2026/fatema-chowdhury.png'
  WHERE event_id = v_event_id
    AND name IN ('Fatema Chowdhury', 'Fatema C (HerAI)');
END $$;
