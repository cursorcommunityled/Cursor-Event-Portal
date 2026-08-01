import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { enqueueAiJob, resolveRepoUrl } from '@/lib/hackathon-analysis/jobs';
import { processAiJobQueue } from '@/lib/hackathon-analysis/job-worker';
import { ensureGithubAccess } from '@/lib/hackathon-analysis/github/repo-fetcher';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServiceClient();

    const body = await req.json() as {
      teamId: string;
      eventId: string;
      adminCode: string;
      force?: boolean;
    };
    const { teamId, eventId, adminCode, force = false } = body;
    if (!teamId || !eventId || !adminCode) {
      return NextResponse.json({ error: 'Missing teamId, eventId, or adminCode' }, { status: 400 });
    }

    const { data: adminEvent } = await supabase
      .from('events')
      .select('id')
      .eq('admin_code', adminCode)
      .eq('id', eventId)
      .maybeSingle();
    if (!adminEvent) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    try {
      await ensureGithubAccess();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 503 }
      );
    }

    const { data: team } = await supabase
      .from('hackathon_teams')
      .select('id, name, event_id')
      .eq('id', teamId)
      .eq('event_id', eventId)
      .single();

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const { data: project } = await supabase
      .from('hackathon_projects')
      .select('submitted_at, repo_url')
      .eq('team_id', teamId)
      .maybeSingle();

    if (!project?.submitted_at) {
      return NextResponse.json({ error: 'Team has not submitted a project' }, { status: 400 });
    }

    const repoUrl = await resolveRepoUrl(supabase, eventId, teamId);
    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Team has no repo URL (checked project + submission backup)' },
        { status: 400 }
      );
    }

    const { job, skipped } = await enqueueAiJob({
      eventId,
      teamId,
      repoUrl,
      force,
      clearFailedPasses: !force,
    });

    // Kick the concurrency-limited worker (non-blocking).
    void processAiJobQueue(eventId);

    return NextResponse.json(
      {
        status: skipped ? 'skipped' : 'queued',
        jobId: job.id,
        jobStatus: job.status,
        skipped: skipped ?? null,
      },
      { status: 202 }
    );
  } catch (e) {
    console.error('[analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
