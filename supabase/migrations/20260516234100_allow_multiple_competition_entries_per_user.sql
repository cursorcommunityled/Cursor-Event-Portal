-- Allow admin-created finalist entries to represent multiple teams owned by one organizer account.
-- Public submission flow still enforces one entry per user in the server action.
ALTER TABLE public.competition_entries
  DROP CONSTRAINT IF EXISTS competition_entries_competition_id_user_id_key;

CREATE INDEX IF NOT EXISTS competition_entries_competition_user_idx
  ON public.competition_entries(competition_id, user_id);

NOTIFY pgrst, 'reload schema';
