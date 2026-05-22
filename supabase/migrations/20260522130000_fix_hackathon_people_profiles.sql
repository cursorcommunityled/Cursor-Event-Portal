-- Force existing SAIT May 2026 mentor/judge rows to use the enriched profile
-- data. Earlier seed migrations only insert when rows do not already exist, so
-- live rows with placeholder bios need an explicit update.

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
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping hackathon profile fix.';
    RETURN;
  END IF;

  UPDATE public.mentors AS mentor
  SET
    name = profile.name,
    company = profile.company,
    title = profile.title,
    bio = profile.bio,
    photo_url = profile.photo_url,
    mentorship_mode = profile.mentorship_mode,
    display_order = profile.display_order,
    is_mentor = profile.is_mentor,
    is_judge = profile.is_judge,
    updated_at = NOW()
  FROM (
    VALUES
      ('Oguzhan Dogru', 'Oguzhan Dogru', 'University of Alberta', 'Judge & Mentor', 'University of Alberta mentor and judge supporting teams on technical architecture, product strategy, and pitching. Oguzhan brings an academic and builder-focused perspective to help teams sharpen both implementation and presentation.', NULL, 'in_person', 10, true, true),
      ('Jia Ming Huang', 'Jia Ming Huang', 'Antler / Cursor', 'Founder, Entrepreneur in Residence & Cursor Ambassador', 'Founder, Entrepreneur in Residence at Antler, and Cursor Ambassador for Calgary and Toronto. Carter brings product, community, startup, and data science perspective from building ventures and hosting large builder events.', '/avatars/hackathon/sait-may-2026/jia-ming-huang.jpg', 'in_person', 20, true, true),
      ('Cal Leung', 'Cal Leung', 'New Era Intelligence Automation', 'Partner & AI Automation Strategist', 'Partner at New Era Intelligence Automation with experience in AI workflow automation, policy strategy, campaigns, and community building. Cal brings a practical lens on operations, positioning, and go-to-market execution.', '/avatars/hackathon/sait-may-2026/cal-leung.jpg', 'in_person', 30, false, true),
      ('Audrey Aui Yong', 'Audrey Aui Yong', 'tsuin.ai', 'CEO & Founder', 'CEO and Founder of tsuin.ai, building AI digital twins for software teams and enterprises. Audrey brings product leadership, startup execution, project management, and enterprise AI implementation experience.', '/avatars/hackathon/sait-may-2026/audrey-aui-yong.jpg', 'in_person', 40, false, true),
      ('Simon Loewen', 'Simon Loewen', 'New Era Intelligence / Terralink Horticulture', 'Agribusiness AI Strategist & Cursor Ambassador', 'Agribusiness AI strategist, Cursor Ambassador, and Alberta Greenhouse Growers Association board member. Simon focuses on practical AI systems, automation, business operations, and supporting builders in Calgary.', '/avatars/hackathon/sait-may-2026/simon-loewen.jpg', 'in_person', 50, true, true),
      ('Alex Young', 'Alex Young', 'Mercury Technologies', 'Senior Software Engineer', 'Software engineer with more than 7 years of experience, primarily in backend microservices and event-driven architecture. Alex has built products in space tech, ad tech, and most recently fintech at Mercury Technologies, and is happy to chat through prototypes, minimum viable products, and how to simplify complex problems.', '/avatars/hackathon/sait-may-2026/alex-young.jpeg', 'in_person', 60, true, false),
      ('Trystan Keller', 'Trystan Keller', 'Saleslink Strategies', 'Event Growth Strategist', 'Event growth strategist helping coaches, consultants, and service providers build authority and generate clients through community events and direct outreach. Trystan brings sales, demand generation, and event marketing judgment.', '/avatars/hackathon/sait-may-2026/trystan-keller.jpg', 'in_person', 70, false, true),
      ('David Lynch', 'David Lynch', 'OpenHouse.ai', 'Co-Owner / VP of Revenue', 'Co-Owner and VP of Revenue at OpenHouse.ai, helping home builders use AI and decision intelligence to improve pace, margin, pricing, and sales execution. David brings deep experience in revenue, growth, consulting, product positioning, and builder-market discovery.', '/avatars/hackathon/sait-may-2026/david-lynch.jpg', 'in_person', 80, true, false),
      ('Anvil Palamattam', 'Anvil Palamattam', 'Google', 'AI & Platform Cloud Architect', 'AI and platform cloud architect at Google focused on enterprise AI, Google Cloud, application modernization, cybersecurity, and distributed systems. Anvil brings deep technical architecture and production deployment experience.', '/avatars/hackathon/sait-may-2026/anvil-palamattam.jpg', 'in_person', 90, true, true),
      ('Suprita Shankar', 'Suprita Shankar', 'Apple', 'Machine Learning Engineer, Foundation Models', 'Machine learning engineer on Apple''s Foundation Models team, working on training data and model performance. Suprita has built large-scale knowledge extraction, entity resolution, and Siri question-answering systems.', '/avatars/hackathon/sait-may-2026/suprita-shankar.jpg', 'virtual', 100, true, true),
      ('Riti Nawroz', 'Riti Nawroz', 'AltaGas', 'Sr Analyst, Digital Strategy and Planning', 'Digital strategy and planning analyst at AltaGas with experience across business analysis, risk, communications, reporting, project delivery, and stakeholder storytelling. Riti brings a strategic operations lens and experience translating complex work into clear stakeholder-ready outcomes.', '/avatars/hackathon/sait-may-2026/riti-nawroz.jpeg', 'in_person', 110, true, false),
      ('Fatema C (HerAI)', 'Fatema Chowdhury', 'AltaGas / HerAI', 'Transportation Analytics Intern & HerAI President', 'Computer Science graduate from the University of Calgary, Transportation Analytics Intern at AltaGas, and President of HerAI: Women in AI/ML. Fatema brings experience in Python, SQL, Power BI, cybersecurity, data analytics, event leadership, and student tech community building.', NULL, 'in_person', 120, true, false),
      ('Fatema Chowdhury', 'Fatema Chowdhury', 'AltaGas / HerAI', 'Transportation Analytics Intern & HerAI President', 'Computer Science graduate from the University of Calgary, Transportation Analytics Intern at AltaGas, and President of HerAI: Women in AI/ML. Fatema brings experience in Python, SQL, Power BI, cybersecurity, data analytics, event leadership, and student tech community building.', NULL, 'in_person', 120, true, false),
      ('Aditya Thakur', 'Aditya Thakur', 'Salesforce', 'Mentor', 'Salesforce mentor supporting teams as they refine technical direction, implementation tradeoffs, and demo readiness. Aditya brings a platform and product lens to help builders simplify ideas into shippable hackathon projects.', NULL, 'in_person', 130, true, false)
  ) AS profile(
    match_name,
    name,
    company,
    title,
    bio,
    photo_url,
    mentorship_mode,
    display_order,
    is_mentor,
    is_judge
  )
  WHERE mentor.event_id = v_event_id
    AND mentor.name = profile.match_name;
END $$;
