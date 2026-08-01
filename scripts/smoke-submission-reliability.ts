/**
 * Offline smoke checks for project submission reliability helpers.
 *
 * Usage (from portal/):
 *   npx tsx scripts/smoke-submission-reliability.ts
 */

import {
  isValidPublicGithubRepoUrl,
  parsePublicGithubRepoUrl,
  submissionPayloadFingerprint,
} from '../src/lib/hackathon/github-repo-url';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('Submission reliability smoke checks…');

assert(!isValidPublicGithubRepoUrl(''), 'empty rejected');
assert(!isValidPublicGithubRepoUrl('https://gitlab.com/owner/repo'), 'non-github rejected');
assert(!isValidPublicGithubRepoUrl('https://github.com/only-owner'), 'missing repo rejected');
assert(!isValidPublicGithubRepoUrl('not a url'), 'garbage rejected');

const parsed = parsePublicGithubRepoUrl('https://www.github.com/Acme/My-App.git');
assert(parsed?.owner === 'Acme', 'owner parsed');
assert(parsed?.repo === 'My-App', 'repo parsed without .git');
assert(parsed?.normalized === 'https://github.com/Acme/My-App', 'normalized https github URL');

assert(
  isValidPublicGithubRepoUrl('github.com/acme/app'),
  'protocol-less github.com/owner/repo accepted'
);

const fpA = submissionPayloadFingerprint({
  name: 'Demo',
  description: 'Hello',
  repoUrl: 'https://github.com/acme/app/',
  demoUrl: 'https://demo.example/',
});
const fpB = submissionPayloadFingerprint({
  name: 'demo',
  description: 'hello',
  repoUrl: 'https://github.com/acme/app',
  demoUrl: 'https://demo.example',
});
assert(fpA === fpB, 'fingerprint normalizes case and trailing slashes');

const fpC = submissionPayloadFingerprint({
  name: 'Demo',
  description: 'Hello',
  repoUrl: 'https://github.com/acme/other',
  demoUrl: 'https://demo.example',
});
assert(fpA !== fpC, 'fingerprint changes when repo changes');

// Simulate heal eligibility: backup with repo + missing submitted_at → healable
type FakeRow = {
  submitted_at: string | null;
  repo_url: string | null;
  backup_repo: string | null;
  primary_project_saved: boolean | null;
};

function isHealable(row: FakeRow): boolean {
  const repo = parsePublicGithubRepoUrl(row.backup_repo ?? row.repo_url);
  if (!repo) return false;
  return !row.submitted_at || row.primary_project_saved === false;
}

assert(
  isHealable({
    submitted_at: null,
    repo_url: null,
    backup_repo: 'https://github.com/acme/app',
    primary_project_saved: false,
  }),
  'backup-only healable'
);
assert(
  !isHealable({
    submitted_at: '2026-07-31T00:00:00Z',
    repo_url: 'https://github.com/acme/app',
    backup_repo: 'https://github.com/acme/app',
    primary_project_saved: true,
  }),
  'healthy row not healable'
);
assert(
  !isHealable({
    submitted_at: '2026-07-31T00:00:00Z',
    repo_url: null,
    backup_repo: null,
    primary_project_saved: true,
  }),
  'submitted without any repo not auto-healable'
);

console.log('OK — GitHub URL validation, fingerprints, and heal eligibility look correct.');
console.log('');
console.log('Manual event-night checklist:');
console.log('1. Run submit_hackathon_project_rpc.sql (or migration) in Supabase');
console.log('2. Attendee submit without repo → blocked in UI + server');
console.log('3. Good submit → confirmation shows saved repo URL');
console.log('4. Admin → AI Screen → At-risk = 0 (Submission Ops green)');
console.log('5. Heal all from backup recovers a deliberately broken backup-only row');
console.log('6. Analyze All reports healed count then queues AI jobs');
