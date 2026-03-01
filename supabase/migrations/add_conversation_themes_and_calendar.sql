-- ============================================================
-- Conversation Themes & Event Calendar
-- Import themes via: COPY or INSERT from your spreadsheet
-- ============================================================

-- Themes library (loaded from spreadsheet, reusable across events)
CREATE TABLE IF NOT EXISTS conversation_themes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT,
  emoji       TEXT,
  category    TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_archived BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active theme per event (upsert on select)
CREATE TABLE IF NOT EXISTS event_theme_selections (
  event_id    UUID        PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  theme_id    UUID        REFERENCES conversation_themes(id) ON DELETE SET NULL,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Central planning calendar (separate from the events table)
CREATE TABLE IF NOT EXISTS planned_events (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT        NOT NULL,
  event_date       DATE        NOT NULL,
  start_time       TIME,
  end_time         TIME,
  venue            TEXT,
  address          TEXT,
  notes            TEXT,
  confirmed        BOOLEAN     NOT NULL DEFAULT false,
  linked_event_id  UUID        REFERENCES events(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_themes_sort ON conversation_themes(sort_order) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_planned_events_date ON planned_events(event_date);

-- ============================================================
-- Seed themes — replace / extend from your spreadsheet
-- ============================================================
INSERT INTO conversation_themes (name, description, emoji, category, sort_order) VALUES
  ('Vibe Coding',         'AI-assisted development and the new flow state of building', '🎧', 'Development',      1),
  ('The Future of Work',  'How AI is reshaping careers, teams, and the way we build',  '🔮', 'Industry',         2),
  ('Building in Public',  'Open source, transparency, and community-driven products',  '🏗️', 'Community',        3),
  ('Zero to One',         'Early-stage tactics, lean validation, and founder mindset', '🚀', 'Entrepreneurship', 4),
  ('The AI Stack',        'Tools, frameworks, and workflows powering modern AI apps',  '🧱', 'Technology',       5),
  ('Founder Stories',     'Real lessons from the trenches of building companies',      '📖', 'Entrepreneurship', 6),
  ('Design Thinking',     'User-first approaches to product, UX, and problem-solving', '🎨', 'Design',           7),
  ('The Art of the Demo', 'How to pitch, present, and persuade with clarity',          '🎤', 'Presentation',     8),
  ('Cursor & Beyond',     'Cursor workflows, IDE tricks, and AI-native dev setups',   '⚡', 'Development',      9),
  ('Infra at Scale',      'Cloud architecture, DevOps, and shipping reliably',         '☁️', 'Infrastructure',   10)
ON CONFLICT DO NOTHING;
