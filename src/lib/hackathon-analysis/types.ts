// ─── GitHub repo data ─────────────────────────────────────────────────────────

export interface RepoFile {
  path: string;
  content: string; // first 2000 chars
}

export interface RepoData {
  owner: string;
  repo: string;
  is_forked: boolean;
  file_count: number;
  languages: Record<string, number>;
  tech_stack: string[];
  template_detected: string | null;
  original_code_ratio: number;
  commit_count_in_window: number;
  commit_authors: string[];
  readme: string; // first 3000 chars
  key_files: RepoFile[]; // up to 15 files
  file_tree: string[]; // up to 200 paths
}

// ─── Pass results ─────────────────────────────────────────────────────────────

export interface Pass1Result {
  github_url: string;
  is_forked: boolean;
  file_count: number;
  languages: Record<string, number>;
  tech_stack: string[];
  template_detected: string | null;
  template_confidence: number;
  original_code_ratio: number;
  commit_count_in_window: number;
  commit_authors: string[];
  readme_summary: string;
  key_files: string[];
}

export interface Pass2Result {
  architecture_notes: string;
  clever_solutions: string[];
  novel_api_integrations: string[];
  creative_moments: string[];
  code_quality_notes: string;
  files_analyzed: string[];
  technical_score_raw: number;
  functional_score_raw: number;
}

export interface Pass3Result {
  innovation_score: number;
  senior_engineer_surprise_factor: 'meh' | 'interesting' | 'impressive' | 'exceptional';
  common_pattern_matches: string[];
  differentiating_factors: string[];
  problem_novelty_notes: string;
}

export interface Pass4Result {
  visual_hierarchy_score: number;
  design_consistency_score: number;
  ux_flow_score: number;
  brand_cohesion_score: number;
  screenshot_relevance_score?: number;
  product_intent_alignment_score?: number;
  overall_visual_score: number;
  screenshots_analyzed: number;
  ux_commentary: string[];
  relevance_notes?: string[];
  product_intent_notes?: string[];
}

export interface Pass5Result {
  pool_rank: number;
  pool_size: number;
  percentile: number;
  relative_standing: string;
  outperforms_pool_on: string[];
  underperforms_pool_on: string[];
  comparable_submissions: string[];
}

export interface CriterionScore {
  criteria_key: string;
  score: number;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface Pass6Result {
  criteria_scores: CriterionScore[];
  overall_score: number;
  most_impressive_aspect: string;
  concerns_and_limitations: string[];
  judge_briefing_points: string[];
  recommended_award_categories: string[];
}

// ─── Pipeline context ─────────────────────────────────────────────────────────

export interface ProjectContext {
  teamId: string;
  eventId: string;
  teamName: string;
  repoUrl: string;
  eventPrompt: string | null;
  pitchText: string | null;
  screenshotUrls: string[];
  /** Optional job id for heartbeats / repo cache persistence. */
  jobId?: string;
}

export interface PoolEntry {
  teamName: string;
  pass1: Pass1Result;
  pass2: Pass2Result;
  pass3: Pass3Result;
}

// ─── DB row ───────────────────────────────────────────────────────────────────

export type PassName =
  | 'pass1_repo'
  | 'pass2_code'
  | 'pass3_innovation'
  | 'pass4_visual'
  | 'pass5_pool'
  | 'pass6_synthesis';

export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'error' | 'cancelled';

export interface HackathonAIAnalysis {
  id: string;
  team_id: string;
  event_id: string;
  pass_name: PassName;
  model_used: string | null;
  result: Pass1Result | Pass2Result | Pass3Result | Pass4Result | Pass5Result | Pass6Result | null;
  status: AnalysisStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Job queue ────────────────────────────────────────────────────────────────

export type AiJobStatus = 'queued' | 'running' | 'complete' | 'error' | 'cancelled';

export type AiJobDiagnostics = {
  repo_cache?: RepoData;
  repo_url?: string;
  warnings?: string[];
  images_loaded?: number;
  images_failed?: number;
  [key: string]: unknown;
};

export interface HackathonAIJob {
  id: string;
  event_id: string;
  team_id: string;
  status: AiJobStatus;
  attempt: number;
  max_attempts: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  current_pass: PassName | string | null;
  last_error: string | null;
  diagnostics: AiJobDiagnostics;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}
