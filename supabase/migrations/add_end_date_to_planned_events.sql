-- Add end_date to planned_events for multi-day event support
ALTER TABLE planned_events
  ADD COLUMN IF NOT EXISTS end_date DATE;
