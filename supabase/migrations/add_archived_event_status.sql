-- Add 'archived' to the event status check constraint
-- Archived events are hidden from admin controls and public pages
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'published', 'active', 'completed', 'archived'));

-- Archive the March 11 and March 14 events (Cowork / Hackathon, not Cursor Meetups)
UPDATE events SET status = 'archived'
WHERE start_time::date IN ('2026-03-11', '2026-03-14');
