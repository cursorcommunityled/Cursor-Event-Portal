-- Lock down public access to events while preserving attendee-facing reads.
--
-- The portal needs anonymous/public clients to read published event metadata
-- for event pages and realtime status checks. All writes are performed by
-- server code with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Make table privileges explicit for PostgREST/Data API roles. RLS handles row
-- visibility; these grants remove public mutation privileges at the table level.
GRANT SELECT ON public.events TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.events FROM anon, authenticated;

-- Replace the older broad select policy with one that only exposes events that
-- should be attendee-visible. Service-role admin/server code can still read any
-- row regardless of this policy.
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "Public can read visible events" ON public.events;

CREATE POLICY "Public can read visible events"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('published', 'active'));

NOTIFY pgrst, 'reload schema';
