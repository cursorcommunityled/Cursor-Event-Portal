-- Durable AI screening job queue with leases / heartbeats.
-- One active job row per team (upserted on enqueue / retry).

CREATE TABLE IF NOT EXISTS public.hackathon_ai_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id          uuid        NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'complete', 'error', 'cancelled')),
  attempt          int         NOT NULL DEFAULT 0,
  max_attempts     int         NOT NULL DEFAULT 3,
  lease_owner      text,
  lease_expires_at timestamptz,
  heartbeat_at     timestamptz,
  current_pass     text,
  last_error       text,
  diagnostics      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  UNIQUE (team_id)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_ai_jobs_event_status
  ON public.hackathon_ai_jobs(event_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_hackathon_ai_jobs_lease
  ON public.hackathon_ai_jobs(status, lease_expires_at)
  WHERE status = 'running';

ALTER TABLE public.hackathon_ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read hackathon_ai_jobs" ON public.hackathon_ai_jobs;
CREATE POLICY "Public read hackathon_ai_jobs"
  ON public.hackathon_ai_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write hackathon_ai_jobs" ON public.hackathon_ai_jobs;
CREATE POLICY "Service write hackathon_ai_jobs"
  ON public.hackathon_ai_jobs FOR ALL USING (true) WITH CHECK (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hackathon_ai_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow cancelled status on analysis passes (sibling passes after a failure).
-- status was free-form text before; keep it free-form, no CHECK change needed.
COMMENT ON TABLE public.hackathon_ai_jobs IS
  'AI screening job queue. Worker claims queued rows with leases; stale leases are swept to error.';
