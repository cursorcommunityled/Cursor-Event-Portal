import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getJobCounts,
  listAiJobs,
  enqueueAiJob,
  resolveRepoUrl,
  sweepStaleAiJobs,
} from '@/lib/hackathon-analysis/jobs';
import { processAiJobQueue } from '@/lib/hackathon-analysis/job-worker';
import {
  ensureGithubAccess,
  ensureGithubBudget,
  getGithubRateLimit,
} from '@/lib/hackathon-analysis/github/repo-fetcher';

async function authorize(adminCode: string, eventId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('admin_code', adminCode)
    .eq('id', eventId)
    .maybeSingle();
  return Boolean(data);
}

/** GET: Screening Ops health + job list */
export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get('eventId');
    const adminCode = req.nextUrl.searchParams.get('adminCode');
    if (!eventId || !adminCode) {
      return NextResponse.json({ error: 'Missing eventId or adminCode' }, { status: 400 });
    }
    if (!(await authorize(adminCode, eventId))) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const counts = await getJobCounts(eventId);
    const jobs = await listAiJobs(eventId);

    let github: Awaited<ReturnType<typeof getGithubRateLimit>> | null = null;
    let githubError: string | null = null;
    try {
      await ensureGithubAccess();
      github = await getGithubRateLimit();
    } catch (e) {
      githubError = e instanceof Error ? e.message : String(e);
    }

    const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

    return NextResponse.json({
      counts,
      jobs,
      github,
      githubError,
      anthropicConfigured,
      concurrency: 3,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST actions:
 * - process: drain queue
 * - sweep: mark stuck jobs/passes error
 * - retry_errors: re-enqueue all error jobs
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      eventId: string;
      adminCode: string;
      action: 'process' | 'sweep' | 'retry_errors';
    };
    const { eventId, adminCode, action } = body;
    if (!eventId || !adminCode || !action) {
      return NextResponse.json({ error: 'Missing eventId, adminCode, or action' }, { status: 400 });
    }
    if (!(await authorize(adminCode, eventId))) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (action === 'sweep') {
      const result = await sweepStaleAiJobs(eventId);
      void processAiJobQueue(eventId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'process') {
      const result = await processAiJobQueue(eventId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'retry_errors') {
      try {
        await ensureGithubAccess();
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 503 }
        );
      }

      const jobs = await listAiJobs(eventId);
      const errored = jobs.filter((j) => j.status === 'error');
      try {
        await ensureGithubBudget(errored.length || 1);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 503 }
        );
      }

      const supabase = await createServiceClient();
      let enqueued = 0;
      const failures: string[] = [];

      for (const job of errored) {
        try {
          const repoUrl = await resolveRepoUrl(supabase, eventId, job.team_id);
          if (!repoUrl) {
            failures.push(`${job.team_id}: no repo URL`);
            continue;
          }
          await enqueueAiJob({
            eventId,
            teamId: job.team_id,
            repoUrl,
            clearFailedPasses: true,
          });
          enqueued++;
        } catch (e) {
          failures.push(`${job.team_id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      void processAiJobQueue(eventId);
      return NextResponse.json({ ok: true, enqueued, failures });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
