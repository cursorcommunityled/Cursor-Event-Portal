export const HACKATHON_SCORE_MAX = 100;

export const HACKATHON_SCORE_CATEGORIES = [
  {
    key: "innovation",
    label: "Innovation & Originality",
    shortLabel: "Innovation",
    weight: 25,
    description: "How novel and surprising is the concept?",
  },
  {
    key: "technical_execution",
    label: "Technical Execution",
    shortLabel: "Technical",
    weight: 25,
    description: "Cleverness and quality of the engineering",
  },
  {
    key: "functional_completeness",
    label: "Functional Completeness",
    shortLabel: "Completeness",
    weight: 20,
    description: "Does the core loop actually work?",
  },
  {
    key: "problem_solution_fit",
    label: "Problem-Solution Fit",
    shortLabel: "Problem Fit",
    weight: 20,
    description: "Is this solving a real problem convincingly?",
  },
  {
    key: "ux_design",
    label: "UX & Design",
    shortLabel: "UX / Design",
    weight: 5,
    description: "Visual polish and usability",
  },
  {
    key: "learning_ambition",
    label: "Learning & Ambition",
    shortLabel: "Ambition",
    weight: 5,
    description: "Did the team stretch themselves?",
  },
] as const;

export type HackathonScoreCategoryKey = typeof HACKATHON_SCORE_CATEGORIES[number]["key"];
export type HackathonScoreValues = Partial<Record<HackathonScoreCategoryKey, number | null | undefined>>;

export function calculateHackathonWeightedScore(scores: HackathonScoreValues): number {
  return Math.round(
    HACKATHON_SCORE_CATEGORIES.reduce((sum, category) => {
      const score = scores[category.key] ?? 0;
      return sum + (score / 10) * category.weight;
    }, 0)
  );
}

export function calculateAverageHackathonWeightedScore(rows: HackathonScoreValues[]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + calculateHackathonWeightedScore(row), 0);
  return Math.round(total / rows.length);
}
