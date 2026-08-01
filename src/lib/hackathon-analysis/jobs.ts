import { createServiceClient } from '@/lib/supabase/server';
import {
  AI_JOB_LEASE_MS,
  AI_JOB_STALE_MS,
} from './constants';
import type {
  AiJobDiagnostics,
  HackathonAIJob,
  PassName,
  RepoData,
} from './types';

export {
  AI_JOB_MAX_CONCURRENCY,
  AI_JOB_LEASE_MS,
  AI_JOB_STALE_MS,
  AI_JOB_HEARTBEAT_MS,
  GITHUB_CALLS_PER_TEAM,
} from './constants';

const STUCK_ERROR =
  'Timed out / worker lost — safe to Retry';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

function nowIso() {
  return new Date().toISOString();
}

function leaseExpiryIso(fromMs = Date.now()) {
  return new Date(fromMs + AI_JOB_LEASE_MS).toISOString();
}

function asJob(row: unknown): HackathonAIJob {
  const r = row as HackathonAIJob;
  return {
    ...r,
    diagnostics: (r.diagnostics ?? {}) as AiJobDiagnostics,
  };
}

export async function resolveRepoUrl(
  supabase: ServiceClient,
  eventId: string,
  teamId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from('hackathon_projects')
    .select('repo_url, submitted_at')
    .eq('team_id', teamId)
    .eq('event_id', eventId)
    .maybeSingle();

  const primary = project?.repo_url?.trim();
  if (primary) return primary;

  const { data: backup } = await supabase
    .from('hackathon_repo_submission_backups')
    .select('repo_url')
    .eq('team_id', teamId)
    .eq('event_id', eventId)
    .maybeSingle();

  return backup?.repo_url?.trim() || null;
}

/**
 * Enqueue (or re-queue) a team for AI screening.
 * Clears stale running analyses when forceResetErrors is true / on retry from error.
 */
export async function enqueueAiJob(opts: {
  eventId: string;
  teamId: string;
  repoUrl: string;
  /** Force re-run even if pass6 is complete. */
  force?: boolean;
  /** Clear error/cancelled/running non-complete passes before queueing. */
  clearFailedPasses?: boolean;
}): Promise<{ job: HackathonAIJob; skipped?: string }> {
  const supabase = await createServiceClient();
  const { eventId, teamId, repoUrl, force = false, clearFailedPasses = true } = opts;

  const { data: pass6 } = await supabase
    .from('hackathon_ai_analyses')
    .select('status')
    .eq('team_id', teamId)
    .eq('pass_name', 'pass6_synthesis')
    .maybeSingle();

  if (!force && pass6?.status === 'complete') {
    const { data: existing } = await supabase
      .from('hackathon_ai_jobs')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();
    if (existing) {
      return { job: asJob(existing), skipped: 'already_complete' };
    }
  }

  const { data: activeJob } = await supabase
    .from('hackathon_ai_jobs')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle();

  if (
    activeJob?.status === 'running' &&
    activeJob.lease_expires_at &&
    new Date(activeJob.lease_expires_at).getTime() > Date.now()
  ) {
    return { job: asJob(activeJob), skipped: 'already_running' };
  }

  if (activeJob?.status === 'queued') {
    return { job: asJob(activeJob), skipped: 'already_queued' };
  }

  if (clearFailedPasses) {
    // Clear non-complete passes so Retry can resume from last complete pass.
    await supabase
      .from('hackathon_ai_analyses')
      .delete()
      .eq('team_id', teamId)
      .eq('event_id', eventId)
      .in('status', ['error', 'cancelled', 'running', 'pending']);
  }

  if (force) {
    await supabase
      .from('hackathon_ai_analyses')
      .delete()
      .eq('team_id', teamId)
      .eq('event_id', eventId);
  }

  const previousDiagnostics = (activeJob?.diagnostics ?? {}) as AiJobDiagnostics;
  const diagnostics: AiJobDiagnostics = {
    ...previousDiagnostics,
    repo_url: repoUrl,
    // Drop repo cache on force re-run so GitHub is re-fetched.
    ...(force ? { repo_cache: undefined } : {}),
  };

  const payload = {
    event_id: eventId,
    team_id: teamId,
    status: 'queued' as const,
    attempt: 0,
    max_attempts: 3,
    lease_owner: null,
    lease_expires_at: null,
    heartbeat_at: null,
    current_pass: null,
    last_error: null,
    diagnostics,
    updated_at: nowIso(),
    started_at: null,
    finished_at: null,
  };

  const { data, error } = await supabase
    .from('hackathon_ai_jobs')
    .upsert(payload, { onConflict: 'team_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to enqueue AI job');
  }

  return { job: asJob(data) };
}

export async function updateJobDiagnostics(
  jobId: string,
  patch: AiJobDiagnostics
): Promise<void> {
  const supabase = await createServiceClient();
  const { data: current } = await supabase
    .from('hackathon_ai_jobs')
    .select('diagnostics')
    .eq('id', jobId)
    .maybeSingle();

  const merged = {
    ...((current?.diagnostics ?? {}) as AiJobDiagnostics),
    ...patch,
  };

  await supabase
    .from('hackathon_ai_jobs')
    .update({ diagnostics: merged, updated_at: nowIso() })
    .eq('id', jobId);
}

export async function saveRepoCache(jobId: string, repoData: RepoData, repoUrl: string) {
  await updateJobDiagnostics(jobId, { repo_cache: repoData, repo_url: repoUrl });
}

export async function heartbeatJob(
  jobId: string,
  leaseOwner: string,
  currentPass?: PassName | string | null
): Promise<boolean> {
  const supabase = await createServiceClient();
  const patch: Record<string, unknown> = {
    heartbeat_at: nowIso(),
    lease_expires_at: leaseExpiryIso(),
    updated_at: nowIso(),
  };
  if (currentPass !== undefined) patch.current_pass = currentPass;

  const { data, error } = await supabase
    .from('hackathon_ai_jobs')
    .update(patch)
    .eq('id', jobId)
    .eq('lease_owner', leaseOwner)
    .eq('status', 'running')
    .select('id')
    .maybeSingle();

  return !error && Boolean(data);
}

export async function markJobComplete(jobId: string): Promise<void> {
  const supabase = await createServiceClient();
  await supabase
    .from('hackathon_ai_jobs')
    .update({
      status: 'complete',
      lease_owner: null,
      lease_expires_at: null,
      current_pass: 'pass6_synthesis',
      last_error: null,
      finished_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('id', jobId);
}

export async function markJobFailed(
  jobId: string,
  errorMessage: string,
  opts?: { requeue?: boolean; attempt?: number; maxAttempts?: number }
): Promise<'requeued' | 'error'> {
  const supabase = await createServiceClient();
  const attempt = opts?.attempt ?? 0;
  const maxAttempts = opts?.maxAttempts ?? 3;
  const shouldRequeue = opts?.requeue ?? attempt + 1 < maxAttempts;

  if (shouldRequeue) {
    await supabase
      .from('hackathon_ai_jobs')
      .update({
        status: 'queued',
        attempt: attempt + 1,
        lease_owner: null,
        lease_expires_at: null,
        last_error: errorMessage,
        finished_at: null,
        updated_at: nowIso(),
      })
      .eq('id', jobId);
    return 'requeued';
  }

  await supabase
    .from('hackathon_ai_jobs')
    .update({
      status: 'error',
      attempt: attempt + 1,
      lease_owner: null,
      lease_expires_at: null,
      last_error: errorMessage,
      finished_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('id', jobId);
  return 'error';
}

/** Sweep stale running jobs + analysis passes. Returns counts. */
export async function sweepStaleAiJobs(eventId?: string): Promise<{
  jobsMarkedError: number;
  passesMarkedError: number;
}> {
  const supabase = await createServiceClient();
  const cutoff = new Date(Date.now() - AI_JOB_STALE_MS).toISOString();
  let jobsMarkedError = 0;
  let passesMarkedError = 0;

  let jobsQuery = supabase
    .from('hackathon_ai_jobs')
    .select('id, heartbeat_at, lease_expires_at, updated_at')
    .eq('status', 'running');
  if (eventId) jobsQuery = jobsQuery.eq('event_id', eventId);

  const { data: runningJobs } = await jobsQuery;
  for (const job of runningJobs ?? []) {
    const beat = job.heartbeat_at ?? job.lease_expires_at ?? job.updated_at;
    if (!beat || beat > cutoff) continue;
    await supabase
      .from('hackathon_ai_jobs')
      .update({
        status: 'error',
        lease_owner: null,
        lease_expires_at: null,
        last_error: STUCK_ERROR,
        finished_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq('id', job.id)
      .eq('status', 'running');
    jobsMarkedError++;
  }

  let passQuery = supabase
    .from('hackathon_ai_analyses')
    .select('id, updated_at')
    .eq('status', 'running')
    .lt('updated_at', cutoff);
  if (eventId) passQuery = passQuery.eq('event_id', eventId);

  const { data: stalePasses } = await passQuery;
  if (stalePasses?.length) {
    const ids = stalePasses.map((p) => p.id);
    await supabase
      .from('hackathon_ai_analyses')
      .update({
        status: 'error',
        error: STUCK_ERROR,
        updated_at: nowIso(),
      })
      .in('id', ids);
    passesMarkedError = ids.length;
  }

  return { jobsMarkedError, passesMarkedError };
}

/**
 * Atomically claim up to `limit` queued jobs for this worker.
 * Also reclaims expired leases by treating them as queued.
 */
export async function claimQueuedJobs(
  eventId: string,
  leaseOwner: string,
  limit: number
): Promise<HackathonAIJob[]> {
  const supabase = await createServiceClient();
  await sweepStaleAiJobs(eventId);

  // Requeue expired leases so they can be claimed.
  const now = nowIso();
  await supabase
    .from('hackathon_ai_jobs')
    .update({
      status: 'queued',
      lease_owner: null,
      lease_expires_at: null,
      last_error: STUCK_ERROR,
      updated_at: now,
    })
    .eq('event_id', eventId)
    .eq('status', 'running')
    .lt('lease_expires_at', now);

  const { data: candidates } = await supabase
    .from('hackathon_ai_jobs')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  const claimed: HackathonAIJob[] = [];
  for (const row of candidates ?? []) {
    const { data, error } = await supabase
      .from('hackathon_ai_jobs')
      .update({
        status: 'running',
        lease_owner: leaseOwner,
        lease_expires_at: leaseExpiryIso(),
        heartbeat_at: nowIso(),
        started_at: row.started_at ?? nowIso(),
        updated_at: nowIso(),
        last_error: null,
      })
      .eq('id', row.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();

    if (!error && data) claimed.push(asJob(data));
  }

  return claimed;
}

export async function listAiJobs(eventId: string): Promise<HackathonAIJob[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('hackathon_ai_jobs')
    .select('*')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  return (data ?? []).map(asJob);
}

export async function getJobCounts(eventId: string): Promise<{
  queued: number;
  running: number;
  error: number;
  complete: number;
  stuck: number;
}> {
  const jobs = await listAiJobs(eventId);
  const cutoff = Date.now() - AI_JOB_STALE_MS;
  const counts = { queued: 0, running: 0, error: 0, complete: 0, stuck: 0 };
  for (const job of jobs) {
    if (job.status === 'queued') counts.queued++;
    else if (job.status === 'running') {
      counts.running++;
      const beat = job.heartbeat_at ?? job.updated_at;
      if (new Date(beat).getTime() < cutoff) counts.stuck++;
    } else if (job.status === 'error') counts.error++;
    else if (job.status === 'complete') counts.complete++;
  }
  return counts;
}

export async function cancelJob(teamId: string, eventId: string): Promise<void> {
  const supabase = await createServiceClient();
  await supabase
    .from('hackathon_ai_jobs')
    .update({
      status: 'cancelled',
      lease_owner: null,
      lease_expires_at: null,
      finished_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('team_id', teamId)
    .eq('event_id', eventId);
}
