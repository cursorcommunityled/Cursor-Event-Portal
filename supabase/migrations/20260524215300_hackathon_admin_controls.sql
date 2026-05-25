-- Add admin-controlled hackathon result visibility and final-round prize metadata.

ALTER TABLE IF EXISTS public.hackathon_settings
  ADD COLUMN IF NOT EXISTS ai_scores_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience_favorite_results_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_round_paid_places INT NOT NULL DEFAULT 3 CHECK (final_round_paid_places >= 1 AND final_round_paid_places <= 10),
  ADD COLUMN IF NOT EXISTS final_round_prizes JSONB NOT NULL DEFAULT '[
    {"placement": 1, "label": "1st Place", "cashValue": 0, "cursorCredits": 0, "notes": "", "isPublic": true},
    {"placement": 2, "label": "2nd Place", "cashValue": 0, "cursorCredits": 0, "notes": "", "isPublic": true},
    {"placement": 3, "label": "3rd Place", "cashValue": 0, "cursorCredits": 0, "notes": "", "isPublic": true}
  ]'::jsonb;

ALTER TABLE IF EXISTS public.competition_judging_results
  ADD COLUMN IF NOT EXISTS prize JSONB NOT NULL DEFAULT '{}'::jsonb;
