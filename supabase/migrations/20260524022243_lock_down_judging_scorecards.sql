-- Prevent unpublished final-round judge scorecards and score items from being
-- publicly readable through the Supabase Data API. Server actions use the
-- service role and continue to bypass RLS for admin reads/writes.

DROP POLICY IF EXISTS "Public read competition_judging_scorecards"
  ON public.competition_judging_scorecards;
DROP POLICY IF EXISTS "No public read competition_judging_scorecards"
  ON public.competition_judging_scorecards;
CREATE POLICY "No public read competition_judging_scorecards"
  ON public.competition_judging_scorecards
  FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "Public read competition_judging_score_items"
  ON public.competition_judging_score_items;
DROP POLICY IF EXISTS "No public read competition_judging_score_items"
  ON public.competition_judging_score_items;
CREATE POLICY "No public read competition_judging_score_items"
  ON public.competition_judging_score_items
  FOR SELECT
  USING (false);
