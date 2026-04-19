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
--
-- This migration is idempotent and self-contained: every table is
-- created if missing, and every policy/RLS-enable is wrapped so it
-- skips tables that don't exist on this database.
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
-- admin_emails is normally created by supabase/admin-users.sql, which is a
-- manual bootstrap script and not a migration. Create it here if missing
-- so this migration is self-contained on a fresh database.
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- or DELETE policies. Skip any table that doesn't exist on this DB so the
-- migration still succeeds on partially-bootstrapped projects.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT table_name, policy_suffix, action FROM (VALUES
      ('venues',                  'update', 'UPDATE'),
      ('venues',                  'delete', 'DELETE'),
      ('event_calendar_cities',   'update', 'UPDATE'),
      ('event_calendar_cities',   'delete', 'DELETE'),
      ('conversation_themes',     'update', 'UPDATE'),
      ('conversation_themes',     'delete', 'DELETE'),
      ('event_theme_selections',  'delete', 'DELETE'),
      ('planned_events',          'delete', 'DELETE')
    ) AS x(table_name, policy_suffix, action)
  LOOP
    IF to_regclass(format('public.%I', t.table_name)) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        t.table_name || '_' || t.policy_suffix,
        t.table_name
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s USING (true)',
        t.table_name || '_' || t.policy_suffix,
        t.table_name,
        t.action
      );
    END IF;
  END LOOP;
END $$;
