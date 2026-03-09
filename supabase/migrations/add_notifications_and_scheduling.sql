-- ─── In-App Notification Preferences ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- in-app toggles (default on)
  poll_opened_inapp         boolean NOT NULL DEFAULT true,
  table_assigned_inapp      boolean NOT NULL DEFAULT true,
  demo_slot_inapp           boolean NOT NULL DEFAULT true,
  survey_live_inapp         boolean NOT NULL DEFAULT true,
  announcements_inapp       boolean NOT NULL DEFAULT true,

  -- email toggles (default off)
  poll_opened_email         boolean NOT NULL DEFAULT false,
  table_assigned_email      boolean NOT NULL DEFAULT false,
  demo_slot_email           boolean NOT NULL DEFAULT false,
  survey_live_email         boolean NOT NULL DEFAULT false,
  announcements_email       boolean NOT NULL DEFAULT false,

  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

-- ─── In-App Notifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type       text NOT NULL,        -- poll_opened | table_assigned | demo_slot_available | survey_live | announcement
  title      text NOT NULL,
  body       text NOT NULL,
  action_url text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS in_app_notifications_user_event
  ON in_app_notifications (user_id, event_id, created_at DESC);

-- ─── Scheduled Items (broadcasts + polls) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_items (
  id                    uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type                  text NOT NULL,  -- announcement | poll
  -- announcement fields
  content               text,
  -- poll fields
  poll_question         text,
  poll_options          jsonb,
  poll_duration_minutes integer,
  -- scheduling
  scheduled_at          timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'pending',  -- pending | sent | cancelled
  sent_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_items_event_status
  ON scheduled_items (event_id, status, scheduled_at);

-- ─── RLS (permissive — app uses service key) ──────────────────────────────────
ALTER TABLE notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_app_notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_items            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_notification_preferences"
  ON notification_preferences FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_in_app_notifications"
  ON in_app_notifications FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_scheduled_items"
  ON scheduled_items FOR ALL USING (true) WITH CHECK (true);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE in_app_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_items;
