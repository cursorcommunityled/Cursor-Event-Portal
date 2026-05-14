-- Add system/suggestion message support to hackathon chat
ALTER TABLE hackathon_chat_messages
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggestion_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index to find suggestion messages quickly (e.g. mark as acted-on)
CREATE INDEX IF NOT EXISTS idx_chat_messages_suggestion
  ON hackathon_chat_messages(channel_id, suggestion_user_id)
  WHERE suggestion_user_id IS NOT NULL;
