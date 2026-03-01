-- ── Venues — physical locations reused across multiple events ─────────────────

CREATE TABLE IF NOT EXISTS venues (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,
  address    TEXT,
  city       TEXT        NOT NULL DEFAULT 'Calgary',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_sort ON venues(sort_order);

-- Seed known Calgary venues
INSERT INTO venues (name, address, city, sort_order) VALUES
  ('Platform Calgary', '1341 Kensington Rd NW, Calgary, AB T2N 3P4', 'Calgary', 1),
  ('House 831',        '831 17 Ave SW, Calgary, AB T2T 0A1',          'Calgary', 2)
ON CONFLICT (name) DO NOTHING;
