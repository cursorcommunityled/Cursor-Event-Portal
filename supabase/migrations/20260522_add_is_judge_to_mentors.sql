-- Add is_judge flag to mentors table
-- Judges appear on the /hackathon/judges page; mentors appear on /hackathon/mentors

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS is_judge boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mentor boolean DEFAULT true;

UPDATE public.mentors
SET is_mentor = true
WHERE is_mentor IS NULL;

ALTER TABLE public.mentors
  ALTER COLUMN is_mentor SET DEFAULT true,
  ALTER COLUMN is_mentor SET NOT NULL;

UPDATE public.mentors
SET is_judge = true
WHERE title ILIKE '%Judge%';

UPDATE public.mentors
SET is_mentor = false
WHERE title ILIKE '%Judge%'
  AND title NOT ILIKE '%Mentor%';

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping LinkedIn profile enrichment.';
    RETURN;
  END IF;

  UPDATE public.mentors
  SET
    is_judge = true,
    is_mentor = CASE
      WHEN name IN (
        'Jia Ming Huang',
        'Simon Loewen',
        'Anvil Palamattam',
        'Suprita Shankar'
      ) THEN true
      ELSE false
    END,
    company = CASE name
      WHEN 'Jia Ming Huang' THEN 'Antler / Cursor'
      WHEN 'Cal Leung' THEN 'New Era Intelligence Automation'
      WHEN 'Audrey Aui Yong' THEN 'tsuin.ai'
      WHEN 'Simon Loewen' THEN 'New Era Intelligence / Terralink Horticulture'
      WHEN 'Trystan Keller' THEN 'Saleslink Strategies'
      WHEN 'Anvil Palamattam' THEN 'Google'
      WHEN 'Suprita Shankar' THEN 'Apple'
      ELSE company
    END,
    title = CASE name
      WHEN 'Jia Ming Huang' THEN 'Founder, Entrepreneur in Residence & Cursor Ambassador'
      WHEN 'Cal Leung' THEN 'Partner & AI Automation Strategist'
      WHEN 'Audrey Aui Yong' THEN 'CEO & Founder'
      WHEN 'Simon Loewen' THEN 'Agribusiness AI Strategist & Cursor Ambassador'
      WHEN 'Trystan Keller' THEN 'Event Growth Strategist'
      WHEN 'Anvil Palamattam' THEN 'AI & Platform Cloud Architect'
      WHEN 'Suprita Shankar' THEN 'Machine Learning Engineer, Foundation Models'
      ELSE title
    END,
    bio = CASE name
      WHEN 'Jia Ming Huang' THEN 'Founder, Entrepreneur in Residence at Antler, and Cursor Ambassador for Calgary and Toronto. Carter brings product, community, startup, and data science perspective from building ventures and hosting large builder events.'
      WHEN 'Cal Leung' THEN 'Partner at New Era Intelligence Automation with experience in AI workflow automation, policy strategy, campaigns, and community building. Cal brings a practical lens on operations, positioning, and go-to-market execution.'
      WHEN 'Audrey Aui Yong' THEN 'CEO and Founder of tsuin.ai, building AI digital twins for software teams and enterprises. Audrey brings product leadership, startup execution, project management, and enterprise AI implementation experience.'
      WHEN 'Simon Loewen' THEN 'Agribusiness AI strategist, Cursor Ambassador, and Alberta Greenhouse Growers Association board member. Simon focuses on practical AI systems, automation, business operations, and supporting builders in Calgary.'
      WHEN 'Trystan Keller' THEN 'Event growth strategist helping coaches, consultants, and service providers build authority and generate clients through community events and direct outreach. Trystan brings sales, demand generation, and event marketing judgment.'
      WHEN 'Anvil Palamattam' THEN 'AI and platform cloud architect at Google focused on enterprise AI, Google Cloud, application modernization, cybersecurity, and distributed systems. Anvil brings deep technical architecture and production deployment experience.'
      WHEN 'Suprita Shankar' THEN 'Machine learning engineer on Apple''s Foundation Models team, working on training data and model performance. Suprita has built large-scale knowledge extraction, entity resolution, and Siri question-answering systems.'
      ELSE bio
    END,
    photo_url = CASE name
      WHEN 'Jia Ming Huang' THEN '/avatars/hackathon/sait-may-2026/jia-ming-huang.jpg'
      WHEN 'Cal Leung' THEN '/avatars/hackathon/sait-may-2026/cal-leung.jpg'
      WHEN 'Audrey Aui Yong' THEN '/avatars/hackathon/sait-may-2026/audrey-aui-yong.jpg'
      WHEN 'Simon Loewen' THEN '/avatars/hackathon/sait-may-2026/simon-loewen.jpg'
      WHEN 'Trystan Keller' THEN '/avatars/hackathon/sait-may-2026/trystan-keller.jpg'
      WHEN 'Anvil Palamattam' THEN '/avatars/hackathon/sait-may-2026/anvil-palamattam.jpg'
      WHEN 'Suprita Shankar' THEN '/avatars/hackathon/sait-may-2026/suprita-shankar.jpg'
      ELSE photo_url
    END,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name IN (
      'Jia Ming Huang',
      'Cal Leung',
      'Audrey Aui Yong',
      'Simon Loewen',
      'Trystan Keller',
      'Anvil Palamattam',
      'Suprita Shankar'
    );

  UPDATE public.mentors
  SET
    name = CASE name
      WHEN 'Fatema C (HerAI)' THEN 'Fatema Chowdhury'
      ELSE name
    END,
    is_judge = false,
    is_mentor = true,
    company = CASE name
      WHEN 'David Lynch' THEN 'OpenHouse.ai'
      WHEN 'Riti Nawroz' THEN 'AltaGas'
      WHEN 'Fatema C (HerAI)' THEN 'AltaGas / HerAI'
      WHEN 'Fatema Chowdhury' THEN 'AltaGas / HerAI'
      ELSE company
    END,
    title = CASE name
      WHEN 'David Lynch' THEN 'Co-Owner / VP of Revenue'
      WHEN 'Riti Nawroz' THEN 'Digital Strategy and Planning'
      WHEN 'Fatema C (HerAI)' THEN 'Transportation Analytics Intern & HerAI President'
      WHEN 'Fatema Chowdhury' THEN 'Transportation Analytics Intern & HerAI President'
      ELSE title
    END,
    bio = CASE name
      WHEN 'David Lynch' THEN 'Co-Owner and VP of Revenue at OpenHouse.ai, helping home builders use AI and decision intelligence to improve pace, margin, pricing, and sales execution. David brings deep experience in revenue, growth, consulting, product positioning, and builder-market discovery.'
      WHEN 'Riti Nawroz' THEN 'Digital Strategy and Planning professional at AltaGas with experience across business analysis, risk, communications, reporting, and project delivery. Riti brings a strategic operations lens and experience translating complex work into clear stakeholder-ready outcomes.'
      WHEN 'Fatema C (HerAI)' THEN 'Computer Science graduate from the University of Calgary, Transportation Analytics Intern at AltaGas, and President of HerAI: Women in AI/ML. Fatema brings experience in Python, SQL, Power BI, cybersecurity, data analytics, event leadership, and student tech community building.'
      WHEN 'Fatema Chowdhury' THEN 'Computer Science graduate from the University of Calgary, Transportation Analytics Intern at AltaGas, and President of HerAI: Women in AI/ML. Fatema brings experience in Python, SQL, Power BI, cybersecurity, data analytics, event leadership, and student tech community building.'
      ELSE bio
    END,
    photo_url = CASE name
      WHEN 'David Lynch' THEN '/avatars/hackathon/sait-may-2026/david-lynch.jpg'
      ELSE photo_url
    END,
    updated_at = NOW()
  WHERE event_id = v_event_id
    AND name IN (
      'David Lynch',
      'Riti Nawroz',
      'Fatema C (HerAI)',
      'Fatema Chowdhury'
    );
END $$;
