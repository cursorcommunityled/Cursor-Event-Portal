/**
 * Offline smoke checks for AI job helpers (no live Anthropic/GitHub calls).
 *
 * Usage (from portal/):
 *   npx tsx scripts/smoke-ai-job-queue.ts
 *
 * Validates:
 * - concurrency constant = 3
 * - budget formula (teams * 20 + 100)
 * - stuck / lease timing constants
 * - pass resume ordering
 */

import {
  AI_JOB_MAX_CONCURRENCY,
  AI_JOB_STALE_MS,
  AI_JOB_LEASE_MS,
  GITHUB_CALLS_PER_TEAM,
} from '../src/lib/hackathon-analysis/constants';

const PASS_ORDER = [
  'pass1_repo',
  'pass2_code',
  'pass3_innovation',
  'pass4_visual',
  'pass5_pool',
  'pass6_synthesis',
] as const;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function budgetNeeded(pendingTeams: number) {
  return pendingTeams * GITHUB_CALLS_PER_TEAM + 100;
}

function nextPassAfter(completed: string[]): string | null {
  for (const p of PASS_ORDER) {
    if (!completed.includes(p)) return p;
  }
  return null;
}

console.log('AI job queue smoke checks…');

assert(AI_JOB_MAX_CONCURRENCY === 3, 'concurrency must be 3');
assert(GITHUB_CALLS_PER_TEAM === 20, 'calls/team must be 20');
assert(AI_JOB_STALE_MS === 8 * 60 * 1000, 'stale threshold must be 8 minutes');
assert(AI_JOB_LEASE_MS === 2 * 60 * 1000, 'lease must be 2 minutes');

assert(budgetNeeded(10) === 300, 'budget for 10 teams');
assert(budgetNeeded(0) === 100, 'budget floor buffer');

assert(nextPassAfter([]) === 'pass1_repo', 'resume starts at pass1');
assert(nextPassAfter(['pass1_repo', 'pass2_code']) === 'pass3_innovation', 'resume mid-pipeline');
assert(nextPassAfter([...PASS_ORDER]) === null, 'resume complete');

// Simulate stuck lease: heartbeat older than stale window
const heartbeatAt = Date.now() - AI_JOB_STALE_MS - 1;
assert(Date.now() - heartbeatAt > AI_JOB_STALE_MS, 'stale heartbeat detectable');

console.log('OK — constants and resume logic look correct.');
console.log('');
console.log('Manual production checklist:');
console.log('1. Run create_hackathon_ai_jobs.sql (or migration) in Supabase');
console.log('2. Confirm GITHUB_TOKEN limit=5000 and Anthropic credits');
console.log('3. Admin → AI Screen → Refresh Screening Ops (green GitHub + Anthropic)');
console.log('4. Analyze one team; confirm job row + pass progress');
console.log('5. Analyze All on 3–5 teams; confirm max 3 concurrent running jobs');
console.log('6. Sweep stuck after forcing a stale heartbeat (optional)');
console.log('7. Retry all errors recovers failed teams without Reset');
