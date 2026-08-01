import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { AI_JOB_HEARTBEAT_MS, AI_JOB_MAX_CONCURRENCY } from './constants';
import {
  claimQueuedJobs,
  heartbeatJob,
  markJobComplete,
  markJobFailed,
  sweepStaleAiJobs,
} from './jobs';
import { runAnalysisPipeline } from './pipeline';
import type { HackathonAIJob, PassName } from './types';

/** In-process concurrency gate so Analyze All cannot stampede GitHub/Anthropic. */
let activeWorkers = 0;
let pumpRunning = false;

async function loadJobContext(job: HackathonAIJob) {
  const supabase = await createServiceClient();

  const [{ data: team }, { data: project }, { data: screenshots }, { data: settings }] =
    await Promise.all([
      supabase
        .from('hackathon_teams')
        .select('id, name')
        .eq('id', job.team_id)
        .eq('event_id', job.event_id)
        .single(),
      supabase
        .from('hackathon_projects')
        .select('repo_url, description, submitted_at')
        .eq('team_id', job.team_id)
        .maybeSingle(),
      supabase
        .from('hackathon_project_screenshots')
        .select('file_url, sort_order')
        .eq('team_id', job.team_id)
        .order('sort_order'),
      supabase
        .from('hackathon_settings')
        .select('prompt_text')
        .eq('event_id', job.event_id)
        .maybeSingle(),
    ]);

  const repoUrl =
    (job.diagnostics?.repo_url as string | undefined)?.trim() ||
    project?.repo_url?.trim() ||
    null;

  if (!team || !repoUrl) {
    throw new Error('Team or repo URL missing for AI job');
  }

  return {
    teamId: job.team_id,
    eventId: job.event_id,
    teamName: team.name as string,
    repoUrl,
    eventPrompt: (settings?.prompt_text as string | null) ?? null,
    pitchText: (project?.description as string | null) ?? null,
    screenshotUrls: (screenshots ?? []).map((s: { file_url: string }) => s.file_url),
    jobId: job.id,
  };
}

async function executeClaimedJob(job: HackathonAIJob, leaseOwner: string): Promise<void> {
  let currentPass: PassName | string | null = job.current_pass;
  const heartbeat = setInterval(() => {
    void heartbeatJob(job.id, leaseOwner, currentPass);
  }, AI_JOB_HEARTBEAT_MS);

  try {
    const ctx = await loadJobContext(job);
    await runAnalysisPipeline(ctx, {
      onPassChange: async (passName) => {
        currentPass = passName;
        await heartbeatJob(job.id, leaseOwner, passName);
      },
    });

    const supabase = await createServiceClient();
    const { data: pass6 } = await supabase
      .from('hackathon_ai_analyses')
      .select('status, error')
      .eq('team_id', job.team_id)
      .eq('pass_name', 'pass6_synthesis')
      .maybeSingle();

    if (pass6?.status === 'complete') {
      await markJobComplete(job.id);
      return;
    }

    const { data: failed } = await supabase
      .from('hackathon_ai_analyses')
      .select('pass_name, error')
      .eq('team_id', job.team_id)
      .eq('status', 'error')
      .limit(1)
      .maybeSingle();

    const message =
      failed?.error ||
      pass6?.error ||
      'Pipeline ended without completing synthesis';

    await markJobFailed(job.id, message, {
      attempt: job.attempt,
      maxAttempts: job.max_attempts,
      requeue: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markJobFailed(job.id, message, {
      attempt: job.attempt,
      maxAttempts: job.max_attempts,
    });
    console.error(`[ai-job-worker] Job ${job.id} failed:`, e);
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Drain queued AI jobs for an event up to the concurrency cap.
 * Safe to call repeatedly (Analyze, Analyze All, Process queue, Sweep).
 */
export async function processAiJobQueue(eventId: string): Promise<{
  claimed: number;
  active: number;
}> {
  if (pumpRunning) {
    return { claimed: 0, active: activeWorkers };
  }
  pumpRunning = true;

  try {
    await sweepStaleAiJobs(eventId);

    const slots = Math.max(0, AI_JOB_MAX_CONCURRENCY - activeWorkers);
    if (slots === 0) {
      return { claimed: 0, active: activeWorkers };
    }

    const leaseOwner = `worker-${randomUUID().slice(0, 8)}`;
    const claimed = await claimQueuedJobs(eventId, leaseOwner, slots);

    // Reserve slots immediately so concurrent pumps cannot over-claim.
    activeWorkers += claimed.length;

    for (const job of claimed) {
      void executeClaimedJob(job, leaseOwner).finally(() => {
        activeWorkers = Math.max(0, activeWorkers - 1);
        void processAiJobQueue(eventId);
      });
    }

    return { claimed: claimed.length, active: activeWorkers };
  } finally {
    pumpRunning = false;
  }
}
