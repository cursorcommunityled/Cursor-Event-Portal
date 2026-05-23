ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS virtual_call_instructions TEXT;
