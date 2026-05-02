-- Generalize demo slots into sessions without renaming existing tables.
-- Safe to run multiple times.

ALTER TABLE public.demo_slots
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS host_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'mentor';

-- Sessions can run in parallel for different mentors, so the old single-slot-per-time
-- constraint is too restrictive. Keep a plain index for listing performance.
ALTER TABLE public.demo_slots
  DROP CONSTRAINT IF EXISTS demo_slots_event_id_starts_at_key;

CREATE INDEX IF NOT EXISTS idx_demo_slots_event_id_starts_at
  ON public.demo_slots(event_id, starts_at);

UPDATE public.demo_slots
SET title = COALESCE(title, 'Mentor Session')
WHERE title IS NULL;

NOTIFY pgrst, 'reload schema';
