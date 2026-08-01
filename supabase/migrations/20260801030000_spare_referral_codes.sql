-- Cumulative spare referral codes (available codes reclaimed after post-event grace)
-- and per-event sweep audit / idempotency.

CREATE TABLE IF NOT EXISTS public.spare_referral_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_code           TEXT NOT NULL UNIQUE,
  referral_url          TEXT NOT NULL,
  amount_usd            INTEGER NOT NULL DEFAULT 20,
  source_event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL,
  source_event_slug     TEXT,
  source_event_name     TEXT,
  was_assigned          BOOLEAN NOT NULL DEFAULT FALSE,
  previous_assigned_to  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status_when_swept     TEXT NOT NULL DEFAULT 'available'
    CHECK (status_when_swept IN ('available')),
  api_message           TEXT,
  api_value             TEXT,
  swept_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spare_referral_codes_swept_at_idx
  ON public.spare_referral_codes (swept_at DESC);

CREATE INDEX IF NOT EXISTS spare_referral_codes_source_event_id_idx
  ON public.spare_referral_codes (source_event_id);

CREATE TABLE IF NOT EXISTS public.event_credit_sweeps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  swept_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_count   INTEGER NOT NULL DEFAULT 0,
  moved_count     INTEGER NOT NULL DEFAULT 0,
  used_count      INTEGER NOT NULL DEFAULT 0,
  invalid_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_credit_sweeps_swept_at_idx
  ON public.event_credit_sweeps (swept_at DESC);

-- Service-role only: enable RLS with no anon/authenticated policies.
ALTER TABLE public.spare_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_credit_sweeps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.spare_referral_codes FROM anon, authenticated;
REVOKE ALL ON public.event_credit_sweeps FROM anon, authenticated;

COMMENT ON TABLE public.spare_referral_codes IS
  'Cumulative pool of Cursor referral codes still available after the post-event grace period; reclaimed from cursor_credits.';
COMMENT ON TABLE public.event_credit_sweeps IS
  'Audit/idempotency log for spare referral code sweeps per event.';
