-- Allow the same Cursor referral code to be reused for a different event.
ALTER TABLE public.cursor_credits
  DROP CONSTRAINT IF EXISTS cursor_credits_credit_code_key;

DROP INDEX IF EXISTS public.cursor_credits_credit_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS cursor_credits_event_id_credit_code_idx
  ON public.cursor_credits (event_id, credit_code);
