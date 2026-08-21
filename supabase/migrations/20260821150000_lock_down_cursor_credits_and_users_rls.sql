-- Drop open USING (true) policies on credit codes and attendee profiles.
-- Anon/authenticated clients must not read or mutate these tables.
-- Server code uses the service role, which bypasses RLS.

ALTER TABLE public.cursor_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cursor_credits FROM anon, authenticated;
REVOKE ALL ON public.users FROM anon, authenticated;

DROP POLICY IF EXISTS "cursor_credits_select" ON public.cursor_credits;
DROP POLICY IF EXISTS "cursor_credits_insert" ON public.cursor_credits;
DROP POLICY IF EXISTS "cursor_credits_update" ON public.cursor_credits;
DROP POLICY IF EXISTS "cursor_credits_delete" ON public.cursor_credits;

DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can be inserted by service role" ON public.users;
DROP POLICY IF EXISTS "Users can be updated by service role" ON public.users;

NOTIFY pgrst, 'reload schema';
