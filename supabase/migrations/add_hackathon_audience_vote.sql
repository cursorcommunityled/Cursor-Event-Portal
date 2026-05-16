-- Add audience vote flag to polls table
-- Run this in the Supabase SQL editor

ALTER TABLE IF EXISTS public.polls
  ADD COLUMN IF NOT EXISTS hackathon_audience_vote boolean NOT NULL DEFAULT false;

-- Index for quick lookup of active audience vote polls per event
DO $$
BEGIN
  IF to_regclass('public.polls') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_polls_hackathon_audience_vote
      ON public.polls (event_id, hackathon_audience_vote, is_active)
      WHERE hackathon_audience_vote = true';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
