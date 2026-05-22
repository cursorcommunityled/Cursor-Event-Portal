ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS mentorship_mode TEXT NOT NULL DEFAULT 'virtual',
  ADD COLUMN IF NOT EXISTS in_person_location TEXT,
  ADD COLUMN IF NOT EXISTS in_person_schedule TEXT;

ALTER TABLE public.demo_slots
  ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES public.mentors(id) ON DELETE SET NULL;

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mentors_mentorship_mode_check'
      AND conrelid = 'public.mentors'::regclass
  ) THEN
    ALTER TABLE public.mentors
      ADD CONSTRAINT mentors_mentorship_mode_check
      CHECK (mentorship_mode IN ('virtual', 'in_person', 'hybrid'));
  END IF;

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
  INSERT INTO public.mentors (event_id, name, company, title, mentorship_mode, display_order, bio, photo_url)
  VALUES
    (v_event_id, 'Oguzhan Dogru', 'CruxOCM', 'Advanced Process Control Engineer', 'in_person', 10, 'Advanced process control engineer at CruxOCM with deep experience in AI-driven process control, reinforcement learning, computer vision, OT/SCADA, and industrial automation. Oguzhan brings a practical research-to-production lens for teams building technical systems, ML workflows, and high-impact demos.', '/avatars/hackathon/sait-may-2026/ozzy.jpeg'),
    (v_event_id, 'Jia Ming Huang', 'Antler / Cursor', 'Founder, Entrepreneur in Residence & Cursor Ambassador', 'in_person', 20, 'Founder, Entrepreneur in Residence at Antler, Cursor Ambassador for Calgary and Toronto, and host at Cappis. Jia brings startup, product, community, and data science perspective from building ventures and organizing large builder events.', '/avatars/hackathon/sait-may-2026/jia-ming-huang.jpg'),
    (v_event_id, 'Cal Leung', 'New Era Intelligence Automation', 'Partner & AI Automation Strategist', 'in_person', 30, 'Partner at New Era Intelligence Automation with experience in AI workflow automation, platform support, policy strategy, campaigns, and community building. Cal brings a practical operations and go-to-market lens for teams turning prototypes into useful systems.', '/avatars/hackathon/sait-may-2026/cal-leung.jpg'),
    (v_event_id, 'Audrey Aui Yong', 'tsuin.ai', 'CEO & Co-Founder', 'in_person', 40, 'CEO and Co-Founder of tsuin.ai, building AI Digital Twin solutions for enterprises modernizing complex systems. Audrey brings project management, no-code development, startup strategy, enterprise AI implementation, and product leadership experience.', '/avatars/hackathon/sait-may-2026/audrey-aui-yong.jpg'),
    (v_event_id, 'Simon Loewen', 'New Era Intelligence / Terralink Horticulture', 'Agribusiness AI Strategist & Cursor Ambassador', 'in_person', 50, 'Agribusiness AI strategist, Cursor Ambassador, and Alberta Greenhouse Growers Association board member working across commercial horticulture and applied AI. Simon helps teams think through practical automation, business workflows, customer-facing systems, and how to turn AI curiosity into useful deployments.', '/avatars/hackathon/sait-may-2026/simon-loewen.jpg'),
    (v_event_id, 'Alex Young', 'Mercury Technologies', 'Senior Software Engineer', 'in_person', 60, 'Software engineer with more than 7 years of experience, primarily in backend microservices and event-driven architecture. Alex has built products in space tech, ad tech, and most recently fintech at Mercury Technologies, and is happy to chat through prototypes, minimum viable products, and how to simplify complex problems.', '/avatars/hackathon/sait-may-2026/alex-young.jpeg'),
    (v_event_id, 'Trystan Keller', 'Saleslink Strategies', 'Event Growth Strategist', 'in_person', 70, 'Event growth strategist helping coaches, consultants, and service providers build authority and generate clients through community events and direct outreach. Trystan brings sales, demand generation, positioning, and event marketing judgment.', '/avatars/hackathon/sait-may-2026/trystan-keller.jpg'),
    (v_event_id, 'David Lynch', 'OpenHouse.ai', 'Co-Owner / VP of Revenue', 'in_person', 80, 'Co-Owner and VP of Revenue at OpenHouse.ai, helping home builders use AI and decision intelligence to improve pace, margin, pricing, and sales execution. David brings deep experience in revenue, growth, consulting, product positioning, and builder-market discovery.', '/avatars/hackathon/sait-may-2026/david-lynch.jpg'),
    (v_event_id, 'Anvil Palamattam', 'Google', 'AI & Platform Cloud Architect', 'in_person', 90, 'AI and platform cloud architect at Google helping enterprise and public-sector teams ship production workloads across Gemini, Google Cloud, Kubernetes, application modernization, cybersecurity, and infrastructure modernization. Anvil brings strong architecture, cloud engineering, and production deployment judgment.', '/avatars/hackathon/sait-may-2026/anvil-palamattam.jpg'),
    (v_event_id, 'Suprita Shankar', 'Apple', 'Machine Learning Engineer, Foundation Models', 'virtual', 100, 'Machine learning engineer at Apple on the Foundation Models team, focused on training data, ablations, and model performance. Suprita has built production-scale knowledge extraction, entity resolution, and Siri question-answering systems, and brings deep ML systems, data-centric AI, and startup engineering experience.', '/avatars/hackathon/sait-may-2026/suprita-shankar.jpg'),
    (v_event_id, 'Riti Nawroz', 'AltaGas', 'Sr Analyst, Digital Strategy and Planning', 'in_person', 110, 'Digital strategy and planning analyst at AltaGas with experience across business analysis, risk, communications, reporting, project delivery, and stakeholder storytelling. Riti brings a strategic operations lens and experience translating complex work into stakeholder-ready outcomes.', '/avatars/hackathon/sait-may-2026/riti-nawroz.jpeg'),
    (v_event_id, 'Fatema Chowdhury', 'AltaGas / HerAI', 'Transportation Analytics Intern & HerAI President', 'in_person', 120, 'Computer Science graduate from the University of Calgary, Transportation Analytics Intern at AltaGas, and President of HerAI: Women in AI/ML. Fatema brings experience in Python, SQL, Power BI, cybersecurity, data analytics, event leadership, and student tech community building.', NULL),
    (v_event_id, 'Aditya Thakur', 'Salesforce', 'Mentor', 'in_person', 130, 'Salesforce mentor supporting teams as they refine technical direction, implementation tradeoffs, and demo readiness. Aditya brings a platform and product lens to help builders simplify ideas into shippable hackathon projects.', NULL);
  END IF;

END $$;
