-- Refresh SAIT May 2026 mentor and judge copy for the public profile pages.
-- This intentionally updates existing rows because the live event was seeded
-- before several speaker bios and photos were finalized.

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS is_judge BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT true;

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id
  FROM public.events
  WHERE slug = 'calgary-hackathon-sait-may-2026'
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Event calgary-hackathon-sait-may-2026 not found, skipping mentor profile refresh.';
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
      ('Oguzhan Dogru', 'Oguzhan Dogru', 'CruxOCM', 'Advanced Process Control Engineer', 'Advanced process control engineer at CruxOCM with deep experience in AI-driven process control, reinforcement learning, computer vision, OT/SCADA, and industrial automation. Oguzhan brings a practical research-to-production lens for teams building technical systems, ML workflows, and high-impact demos.', '/avatars/hackathon/sait-may-2026/ozzy.jpeg', 'in_person', 10, true, true),
      ('Jia Ming Huang', 'Jia Ming Huang', 'Antler / Cursor', 'Founder, Entrepreneur in Residence & Cursor Ambassador', 'Founder, Entrepreneur in Residence at Antler, Cursor Ambassador for Calgary and Toronto, and host at Cappis. Jia brings startup, product, community, and data science perspective from building ventures and organizing large builder events.', '/avatars/hackathon/sait-may-2026/jia-ming-huang.jpg', 'in_person', 20, true, true),
      ('Cal Leung', 'Cal Leung', 'New Era Intelligence Automation', 'Partner & AI Automation Strategist', 'Partner at New Era Intelligence Automation with experience in AI workflow automation, platform support, policy strategy, campaigns, and community building. Cal brings a practical operations and go-to-market lens for teams turning prototypes into useful systems.', '/avatars/hackathon/sait-may-2026/cal-leung.jpg', 'in_person', 30, false, true),
      ('Audrey Aui Yong', 'Audrey Aui Yong', 'tsuin.ai', 'CEO & Co-Founder', 'CEO and Co-Founder of tsuin.ai, building AI Digital Twin solutions for enterprises modernizing complex systems. Audrey brings project management, no-code development, startup strategy, enterprise AI implementation, and product leadership experience.', '/avatars/hackathon/sait-may-2026/audrey-aui-yong.jpg', 'in_person', 40, false, true),
      ('Simon Loewen', 'Simon Loewen', 'New Era Intelligence / Terralink Horticulture', 'Agribusiness AI strategist, Cursor Ambassador, and Alberta Greenhouse Growers Association board member working across commercial horticulture and applied AI. Simon helps teams think through practical automation, business workflows, customer-facing systems, and useful AI deployments.', '/avatars/hackathon/sait-may-2026/simon-loewen.jpg', 'in_person', 50, true, true),
      ('Alex Young', 'Alex Young', 'Mercury Technologies', 'Senior Software Engineer', 'Software engineer with more than 7 years of experience, primarily in backend microservices and event-driven architecture. Alex has built products in space tech, ad tech, and most recently fintech at Mercury Technologies, and is happy to chat through prototypes, minimum viable products, and how to simplify complex problems.', '/avatars/hackathon/sait-may-2026/alex-young.jpeg', 'in_person', 60, true, false),
      ('Trystan Keller', 'Trystan Keller', 'Saleslink Strategies', 'Event Growth Strategist', 'Event growth strategist helping coaches, consultants, and service providers build authority and generate clients through community events and direct outreach. Trystan brings sales, demand generation, positioning, and event marketing judgment.', '/avatars/hackathon/sait-may-2026/trystan-keller.jpg', 'in_person', 70, false, true),
      ('David Lynch', 'David Lynch', 'OpenHouse.ai', 'Co-Owner / VP of Revenue', 'Co-Owner and VP of Revenue at OpenHouse.ai, helping home builders use AI and decision intelligence to improve pace, margin, pricing, and sales execution. David brings deep experience in revenue, growth, consulting, product positioning, and builder-market discovery.', '/avatars/hackathon/sait-may-2026/david-lynch.jpg', 'in_person', 80, true, false),
      ('Anvil Palamattam', 'Anvil Palamattam', 'Google', 'AI & Platform Cloud Architect', 'AI and platform cloud architect at Google helping enterprise and public-sector teams ship production workloads across Gemini, Google Cloud, Kubernetes, application modernization, cybersecurity, and infrastructure modernization. Anvil brings strong architecture, cloud engineering, and production deployment judgment.', '/avatars/hackathon/sait-may-2026/anvil-palamattam.jpg', 'in_person', 90, true, true),
      ('Suprita Shankar', 'Suprita Shankar', 'Apple', 'Machine Learning Engineer, Foundation Models', 'Machine learning engineer at Apple on the Foundation Models team, focused on training data, ablations, and model performance. Suprita has built production-scale knowledge extraction, entity resolution, and Siri question-answering systems, and brings deep ML systems, data-centric AI, and startup engineering experience.', '/avatars/hackathon/sait-may-2026/suprita-shankar.jpg', 'virtual', 100, true, true),
      ('Riti Nawroz', 'Riti Nawroz', 'AltaGas', 'Sr Analyst, Digital Strategy and Planning', 'Digital strategy and planning analyst at AltaGas with experience across business analysis, risk, communications, reporting, project delivery, and stakeholder storytelling. Riti brings a strategic operations lens and experience translating complex work into stakeholder-ready outcomes.', '/avatars/hackathon/sait-may-2026/riti-nawroz.jpeg', 'in_person', 110, true, false),
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
