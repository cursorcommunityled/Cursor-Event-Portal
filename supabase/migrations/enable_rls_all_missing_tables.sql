-- ============================================================
-- Enable RLS on all tables that were missing it
-- Fixes Supabase "rls_disabled_in_public" security warning
-- Project: Cursor Popup (flyvgpsltyitcvjvhljh)
-- ============================================================

-- 1) public.users — attendee profiles
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select"
  ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert"
  ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update"
  ON public.users FOR UPDATE USING (true);

-- 2) cursor_credits — credit codes (read-only for anon; admin manages via service role)
ALTER TABLE public.cursor_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cursor_credits_select" ON public.cursor_credits;
CREATE POLICY "cursor_credits_select"
  ON public.cursor_credits FOR SELECT USING (true);

DROP POLICY IF EXISTS "cursor_credits_insert" ON public.cursor_credits;
CREATE POLICY "cursor_credits_insert"
  ON public.cursor_credits FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "cursor_credits_update" ON public.cursor_credits;
CREATE POLICY "cursor_credits_update"
  ON public.cursor_credits FOR UPDATE USING (true);

-- 3) venues — reference data
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_select" ON public.venues;
CREATE POLICY "venues_select"
  ON public.venues FOR SELECT USING (true);

DROP POLICY IF EXISTS "venues_insert" ON public.venues;
CREATE POLICY "venues_insert"
  ON public.venues FOR INSERT WITH CHECK (true);

-- 4) event_calendar_cities — reference data
ALTER TABLE public.event_calendar_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_calendar_cities_select" ON public.event_calendar_cities;
CREATE POLICY "event_calendar_cities_select"
  ON public.event_calendar_cities FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_calendar_cities_insert" ON public.event_calendar_cities;
CREATE POLICY "event_calendar_cities_insert"
  ON public.event_calendar_cities FOR INSERT WITH CHECK (true);

-- 5) conversation_themes — theme library
ALTER TABLE public.conversation_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_themes_select" ON public.conversation_themes;
CREATE POLICY "conversation_themes_select"
  ON public.conversation_themes FOR SELECT USING (true);

DROP POLICY IF EXISTS "conversation_themes_insert" ON public.conversation_themes;
CREATE POLICY "conversation_themes_insert"
  ON public.conversation_themes FOR INSERT WITH CHECK (true);

-- 6) event_theme_selections — which theme is active per event
ALTER TABLE public.event_theme_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_theme_selections_select" ON public.event_theme_selections;
CREATE POLICY "event_theme_selections_select"
  ON public.event_theme_selections FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_theme_selections_insert" ON public.event_theme_selections;
CREATE POLICY "event_theme_selections_insert"
  ON public.event_theme_selections FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "event_theme_selections_update" ON public.event_theme_selections;
CREATE POLICY "event_theme_selections_update"
  ON public.event_theme_selections FOR UPDATE USING (true);

-- 7) planned_events — planning calendar
ALTER TABLE public.planned_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planned_events_select" ON public.planned_events;
CREATE POLICY "planned_events_select"
  ON public.planned_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "planned_events_insert" ON public.planned_events;
CREATE POLICY "planned_events_insert"
  ON public.planned_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "planned_events_update" ON public.planned_events;
CREATE POLICY "planned_events_update"
  ON public.planned_events FOR UPDATE USING (true);
