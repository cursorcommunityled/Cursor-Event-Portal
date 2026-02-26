-- Demo slot signup feature
-- Rules:
-- - Slots are 5 minutes each
-- - Each slot has 2 spots by default
-- - Each attendee can hold at most one slot per event

CREATE TABLE IF NOT EXISTS demo_signup_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  speaker_name TEXT,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS demo_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, starts_at),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS demo_slot_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES demo_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_id, user_id),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_demo_signup_settings_event_id ON demo_signup_settings(event_id);
CREATE INDEX IF NOT EXISTS idx_demo_slots_event_id_starts_at ON demo_slots(event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_demo_slot_signups_slot_id ON demo_slot_signups(slot_id);
CREATE INDEX IF NOT EXISTS idx_demo_slot_signups_event_id ON demo_slot_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_demo_slot_signups_user_id ON demo_slot_signups(user_id);

CREATE OR REPLACE FUNCTION set_demo_signup_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_demo_signup_settings_updated_at ON demo_signup_settings;
CREATE TRIGGER trg_demo_signup_settings_updated_at
  BEFORE UPDATE ON demo_signup_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_demo_signup_settings_updated_at();

CREATE OR REPLACE FUNCTION enforce_demo_slot_capacity()
RETURNS TRIGGER AS $$
DECLARE
  slot_capacity INTEGER;
  current_count INTEGER;
BEGIN
  -- Lock the slot row so concurrent inserts on same slot serialize
  SELECT capacity
  INTO slot_capacity
  FROM demo_slots
  WHERE id = NEW.slot_id
  FOR UPDATE;

  IF slot_capacity IS NULL THEN
    RAISE EXCEPTION 'Demo slot not found';
  END IF;

  SELECT COUNT(*)
  INTO current_count
  FROM demo_slot_signups
  WHERE slot_id = NEW.slot_id;

  IF current_count >= slot_capacity THEN
    RAISE EXCEPTION 'Demo slot is full';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_demo_slot_capacity ON demo_slot_signups;
CREATE TRIGGER trg_enforce_demo_slot_capacity
  BEFORE INSERT ON demo_slot_signups
  FOR EACH ROW
  EXECUTE FUNCTION enforce_demo_slot_capacity();

ALTER TABLE demo_signup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_slot_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Demo settings are viewable by everyone"
  ON demo_signup_settings FOR SELECT USING (true);
CREATE POLICY "Demo settings can be inserted by service role"
  ON demo_signup_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Demo settings can be updated by service role"
  ON demo_signup_settings FOR UPDATE USING (true);
CREATE POLICY "Demo settings can be deleted by service role"
  ON demo_signup_settings FOR DELETE USING (true);

CREATE POLICY "Demo slots are viewable by everyone"
  ON demo_slots FOR SELECT USING (true);
CREATE POLICY "Demo slots can be inserted by service role"
  ON demo_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "Demo slots can be updated by service role"
  ON demo_slots FOR UPDATE USING (true);
CREATE POLICY "Demo slots can be deleted by service role"
  ON demo_slots FOR DELETE USING (true);

CREATE POLICY "Demo signups are viewable by everyone"
  ON demo_slot_signups FOR SELECT USING (true);
CREATE POLICY "Demo signups can be inserted by service role"
  ON demo_slot_signups FOR INSERT WITH CHECK (true);
CREATE POLICY "Demo signups can be deleted by service role"
  ON demo_slot_signups FOR DELETE USING (true);
