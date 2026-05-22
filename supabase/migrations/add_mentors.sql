-- Mentor profiles for session booking
CREATE TABLE IF NOT EXISTS public.mentors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  bio TEXT,
  photo_url TEXT,
  meet_link TEXT,
  mentorship_mode TEXT NOT NULL DEFAULT 'virtual' CONSTRAINT mentors_mentorship_mode_check CHECK (mentorship_mode IN ('virtual', 'in_person', 'hybrid')),
  in_person_location TEXT,
  in_person_schedule TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS mentorship_mode TEXT NOT NULL DEFAULT 'virtual',
  ADD COLUMN IF NOT EXISTS in_person_location TEXT,
  ADD COLUMN IF NOT EXISTS in_person_schedule TEXT;

UPDATE public.mentors
SET mentorship_mode = 'virtual'
WHERE mentorship_mode IS NULL;

ALTER TABLE public.mentors
  ALTER COLUMN mentorship_mode SET DEFAULT 'virtual',
  ALTER COLUMN mentorship_mode SET NOT NULL;

DO $$
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
END $$;

ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mentors FROM anon, authenticated;

DROP POLICY IF EXISTS "Service role full access to mentors"
  ON public.mentors;
CREATE POLICY "Service role full access to mentors"
  ON public.mentors FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Link demo slots to a mentor profile
ALTER TABLE public.demo_slots
  ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES public.mentors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mentors_event_id_idx ON public.mentors(event_id);
CREATE INDEX IF NOT EXISTS demo_slots_mentor_id_idx ON public.demo_slots(mentor_id);
