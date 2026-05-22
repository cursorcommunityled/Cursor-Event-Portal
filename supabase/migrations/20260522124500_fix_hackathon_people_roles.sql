-- Re-apply SAIT May 2026 mentor/judge role flags with a migration version
-- newer than 20260522123000 so deployed databases pick it up in order.

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS is_judge BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT true;

UPDATE public.mentors
SET
  is_judge = COALESCE(is_judge, false),
  is_mentor = COALESCE(is_mentor, true);

ALTER TABLE public.mentors
  ALTER COLUMN is_judge SET DEFAULT false,
  ALTER COLUMN is_judge SET NOT NULL,
  ALTER COLUMN is_mentor SET DEFAULT true,
  ALTER COLUMN is_mentor SET NOT NULL;

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping hackathon people role fix.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET
    is_judge = true,
    is_mentor = true,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name IN (
      'Oguzhan Dogru',
      'Jia Ming Huang',
      'Simon Loewen',
      'Anvil Palamattam',
      'Suprita Shankar'
    );

  UPDATE public.mentors
  SET
    is_judge = true,
    is_mentor = false,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name IN (
      'Cal Leung',
      'Audrey Aui Yong',
      'Trystan Keller'
    );

  UPDATE public.mentors
  SET
    is_judge = false,
    is_mentor = true,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name IN (
      'Alex Young',
      'David Lynch',
      'Riti Nawroz',
      'Fatema C (HerAI)',
      'Fatema Chowdhury',
      'Aditya Thakur'
    );

  UPDATE public.mentors
  SET
    company = 'Mercury Technologies',
    title = 'Senior Software Engineer',
    bio = 'Software engineer with more than 7 years of experience, primarily in backend microservices and event-driven architecture. Alex has built products in space tech, ad tech, and most recently fintech at Mercury Technologies, and is happy to chat through prototypes, minimum viable products, and how to simplify complex problems.',
    photo_url = '/avatars/hackathon/sait-may-2026/alex-young.jpeg',
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name = 'Alex Young';

  UPDATE public.mentors
  SET
    company = 'AltaGas',
    title = 'Sr Analyst, Digital Strategy and Planning',
    bio = 'Digital strategy and planning analyst at AltaGas with experience across business analysis, risk, communications, reporting, project delivery, and stakeholder storytelling. Riti brings a strategic operations lens and experience translating complex work into clear stakeholder-ready outcomes.',
    photo_url = '/avatars/hackathon/sait-may-2026/riti-nawroz.jpeg',
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name = 'Riti Nawroz';
END $$;
