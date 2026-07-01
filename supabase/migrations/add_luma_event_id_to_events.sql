-- Luma integration: map portal events to Luma events so webhook/API sync
-- can resolve incoming Luma guests to the right portal event.
-- Luma event IDs look like "evt-XXXXXXXXXXXX".

ALTER TABLE events ADD COLUMN IF NOT EXISTS luma_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_events_luma_event_id
  ON events (luma_event_id)
  WHERE luma_event_id IS NOT NULL;
