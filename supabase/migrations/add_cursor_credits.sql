CREATE TABLE cursor_credits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  credit_code      TEXT NOT NULL,
  assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
  registration_id  UUID REFERENCES registrations(id) ON DELETE SET NULL,
  amount_usd       INTEGER NOT NULL DEFAULT 20,
  assigned_at      TIMESTAMPTZ,
  redeemed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(credit_code),
  UNIQUE(event_id, assigned_to)
);

CREATE INDEX cursor_credits_event_id_idx    ON cursor_credits(event_id);
CREATE INDEX cursor_credits_assigned_to_idx ON cursor_credits(assigned_to);
