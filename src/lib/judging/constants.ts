// Per-browser cookie used to give each unlogged-in Final Round judge a stable,
// distinct identity. Kept dependency-free so it can be imported from middleware
// (Edge runtime) as well as server actions.
export const HACKATHON_JUDGE_COOKIE = "hk_judge_id";
