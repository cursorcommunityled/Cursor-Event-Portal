-- ─── Hackathon Chat ──────────────────────────────────────────────────────────

-- Channels (general, announcements, team-specific, resources)
CREATE TABLE IF NOT EXISTS hackathon_chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id uuid REFERENCES hackathon_teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'general', -- 'general' | 'announcements' | 'team' | 'resources'
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, name)
);

-- Messages (soft-deletable, supports text + file attachments)
CREATE TABLE IF NOT EXISTS hackathon_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES hackathon_chat_channels(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  content text,
  file_url text,
  file_type text,       -- 'image' | 'file'
  file_name text,
  file_size_bytes int,
  is_pinned boolean NOT NULL DEFAULT false,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-user channel read cursor (for unread badges)
CREATE TABLE IF NOT EXISTS hackathon_chat_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES hackathon_chat_channels(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

-- Emoji reactions on messages
CREATE TABLE IF NOT EXISTS hackathon_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES hackathon_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON hackathon_chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_event ON hackathon_chat_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_event ON hackathon_chat_channels(event_id, position);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON hackathon_chat_reactions(message_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE hackathon_chat_channels;
