-- Allow a user to have multiple credits per event (e.g. $20 sponsor + $50 easter egg).
-- The original UNIQUE(event_id, assigned_to) constraint prevents this.

ALTER TABLE cursor_credits DROP CONSTRAINT IF EXISTS cursor_credits_event_id_assigned_to_key;
