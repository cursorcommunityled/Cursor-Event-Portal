-- ============================================================
-- Security audit follow-up: enable RLS + add policies on the
-- handful of public tables that were still missing RLS.
--
-- This matches the existing app pattern: writes are performed
-- exclusively from server-side code using SUPABASE_SERVICE_ROLE_KEY
-- (which bypasses RLS), and reads use the anon key. Without RLS,
-- those tables were directly read/writeable by anyone with the
-- anon key, which is the actual risk.
--
-- Tables covered:
--   - agenda_items         (defined in schema.sql, no RLS)
--   - announcements        (defined in schema.sql, no RLS)
--   - sessions             (defined in schema.sql, no RLS — sensitive: holds passcodes)
--   - admin_emails         (defined in admin-users.sql, no RLS — sensitive: admin allow-list)
--   - magic_links          (referenced by auth.ts; create if missing + lock down)
-- ============================================================

-- ---------- agenda_items: public read, server-only writes ----------
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agenda items are viewable by everyone" ON public.agenda_items;
CREATE POLICY "Agenda items are viewable by everyone"
  ON public.agenda_items FOR SELECT USING (true);

-- No public INSERT/UPDATE/DELETE policies: service role bypasses RLS,
-- so admin server actions still work; the anon key cannot mutate.

-- ---------- announcements: public read, server-only writes ----------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Announcements are viewable by everyone" ON public.announcements;
CREATE POLICY "Announcements are viewable by everyone"
  ON public.announcements FOR SELECT USING (true);

-- ---------- sessions: server-only access (passcodes are sensitive) ----------
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon. The auth flow
-- (loginWithPasscode, createPasscodeSession) runs server-side with
-- the service role, which bypasses RLS, so it keeps working.
-- This prevents anyone with the anon key from listing valid passcodes.

-- ---------- admin_emails: server-only access (admin allow-list) ----------
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- No public policies. Middleware/admin-role checks must use the
-- service-role server client. This stops the anon client from
-- enumerating admin emails (which would let an attacker know whom
-- to target with phishing or magic-link abuse).

-- ---------- magic_links: ensure table exists + lock down ----------
-- auth.ts already INSERT/UPDATEs this table from server actions.
-- If it doesn't exist yet (the action wraps the call in try/catch),
-- create it now so RLS actually applies.
CREATE TABLE IF NOT EXISTS public.magic_links (
  token       TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON public.magic_links(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_event_id ON public.magic_links(event_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON public.magic_links(expires_at);

ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;
-- No anon policies — magic-link tokens must never be queryable from the client.

-- ---------- Backfill UPDATE/DELETE policies on tables that only had INSERT/SELECT ----------
-- Some earlier migrations enabled RLS + SELECT/INSERT but never added UPDATE
-- or DELETE policies, which silently breaks server-side updates if the service
-- role key is ever rotated to anon by mistake. Add the missing service-role
-- pass-throughs so the existing pattern is uniform.

DROP POLICY IF EXISTS "venues_update" ON public.venues;
CREATE POLICY "venues_update" ON public.venues FOR UPDATE USING (true);

DROP POLICY IF EXISTS "venues_delete" ON public.venues;
CREATE POLICY "venues_delete" ON public.venues FOR DELETE USING (true);

DROP POLICY IF EXISTS "event_calendar_cities_update" ON public.event_calendar_cities;
CREATE POLICY "event_calendar_cities_update" ON public.event_calendar_cities FOR UPDATE USING (true);

DROP POLICY IF EXISTS "event_calendar_cities_delete" ON public.event_calendar_cities;
CREATE POLICY "event_calendar_cities_delete" ON public.event_calendar_cities FOR DELETE USING (true);

DROP POLICY IF EXISTS "conversation_themes_update" ON public.conversation_themes;
CREATE POLICY "conversation_themes_update" ON public.conversation_themes FOR UPDATE USING (true);

DROP POLICY IF EXISTS "conversation_themes_delete" ON public.conversation_themes;
CREATE POLICY "conversation_themes_delete" ON public.conversation_themes FOR DELETE USING (true);

DROP POLICY IF EXISTS "event_theme_selections_delete" ON public.event_theme_selections;
CREATE POLICY "event_theme_selections_delete" ON public.event_theme_selections FOR DELETE USING (true);

DROP POLICY IF EXISTS "planned_events_delete" ON public.planned_events;
CREATE POLICY "planned_events_delete" ON public.planned_events FOR DELETE USING (true);
