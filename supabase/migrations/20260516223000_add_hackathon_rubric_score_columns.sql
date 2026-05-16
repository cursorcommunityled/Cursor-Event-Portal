-- Align manual hackathon scoring with the 7-criterion weighted rubric.

ALTER TABLE public.hackathon_scores
  ADD COLUMN IF NOT EXISTS technical_execution INT CHECK (technical_execution BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS functional_completeness INT CHECK (functional_completeness BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS problem_solution_fit INT CHECK (problem_solution_fit BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS ux_design INT CHECK (ux_design BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS demo_communication INT CHECK (demo_communication BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS learning_ambition INT CHECK (learning_ambition BETWEEN 0 AND 10);

UPDATE public.hackathon_scores
SET
  technical_execution = COALESCE(technical_execution, execution),
  functional_completeness = COALESCE(functional_completeness, execution),
  problem_solution_fit = COALESCE(problem_solution_fit, presentation),
  ux_design = COALESCE(ux_design, ux_polish),
  demo_communication = COALESCE(demo_communication, presentation),
  learning_ambition = COALESCE(
    learning_ambition,
    ROUND((
      COALESCE(innovation, 0) +
      COALESCE(execution, 0) +
      COALESCE(presentation, 0) +
      COALESCE(ux_polish, 0)
    ) / 4.0)::INT
  )
WHERE
  technical_execution IS NULL
  OR functional_completeness IS NULL
  OR problem_solution_fit IS NULL
  OR ux_design IS NULL
  OR demo_communication IS NULL
  OR learning_ambition IS NULL;

UPDATE public.competition_judging_criteria
SET
  label = 'Problem-Solution Fit',
  description = 'Is this solving a real problem convincingly?',
  max_points = 20,
  weight = 20,
  sort_order = 3,
  updated_at = NOW()
WHERE slug = 'problem-solution-fit';

UPDATE public.competition_judging_criteria
SET
  label = 'UX & Design',
  description = 'Visual polish and usability',
  max_points = 5,
  weight = 5,
  sort_order = 4,
  updated_at = NOW()
WHERE slug = 'ux-design';

UPDATE public.competition_judging_criteria
SET
  sort_order = 5,
  updated_at = NOW()
WHERE slug = 'demo-communication';

INSERT INTO public.competition_judging_criteria (
  event_id,
  competition_id,
  slug,
  label,
  description,
  max_points,
  weight,
  sort_order
)
SELECT DISTINCT
  c.event_id,
  c.competition_id,
  'learning-ambition',
  'Learning & Ambition',
  'Did the team stretch themselves?',
  5,
  5,
  6
FROM public.competition_judging_criteria c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.competition_judging_criteria existing
  WHERE existing.competition_id = c.competition_id
    AND existing.slug = 'learning-ambition'
)
ON CONFLICT (competition_id, slug) DO NOTHING;
