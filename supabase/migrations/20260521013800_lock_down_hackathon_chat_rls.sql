-- Lock down hackathon chat tables so browser clients cannot read private
-- channels/messages directly with the public Supabase key.
--
-- Chat access is enforced in server actions using the portal session cookie and
-- service role client. Do not add anon/authenticated read policies here unless
-- the app moves to Supabase Auth-backed row policies.

ALTER TABLE public.hackathon_chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_chat_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_chat_reactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hackathon_chat_channels FROM anon, authenticated;
REVOKE ALL ON TABLE public.hackathon_chat_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.hackathon_chat_reads FROM anon, authenticated;
REVOKE ALL ON TABLE public.hackathon_chat_reactions FROM anon, authenticated;

DROP POLICY IF EXISTS "Service role manages hackathon chat channels"
  ON public.hackathon_chat_channels;
CREATE POLICY "Service role manages hackathon chat channels"
  ON public.hackathon_chat_channels
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages hackathon chat messages"
  ON public.hackathon_chat_messages;
CREATE POLICY "Service role manages hackathon chat messages"
  ON public.hackathon_chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages hackathon chat reads"
  ON public.hackathon_chat_reads;
CREATE POLICY "Service role manages hackathon chat reads"
  ON public.hackathon_chat_reads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages hackathon chat reactions"
  ON public.hackathon_chat_reactions;
CREATE POLICY "Service role manages hackathon chat reactions"
  ON public.hackathon_chat_reactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
