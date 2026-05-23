-- Add the shared Help chat channel to existing hackathon events.
INSERT INTO hackathon_chat_channels (event_id, name, channel_type, position)
SELECT id, 'help', 'help', 4
FROM events
WHERE is_hackathon = true
ON CONFLICT (event_id, name) DO NOTHING;
