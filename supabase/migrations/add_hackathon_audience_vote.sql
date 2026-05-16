-- Add audience vote flag to polls table
-- Run this in the Supabase SQL editor

ALTER TABLE polls ADD COLUMN IF NOT EXISTS hackathon_audience_vote boolean DEFAULT false;

-- Index for quick lookup of active audience vote polls per event
CREATE INDEX IF NOT EXISTS idx_polls_hackathon_audience_vote
  ON polls (event_id, hackathon_audience_vote, is_active)
  WHERE hackathon_audience_vote = true;
