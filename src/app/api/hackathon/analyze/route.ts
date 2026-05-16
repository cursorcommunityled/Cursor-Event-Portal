import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/registration';
import { runAnalysisPipeline } from '@/lib/hackathon-analysis/pipeline';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const supabase = await createServiceClient();

    // Verify admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.userId)
      .maybeSingle();
    const adminRoles = ['admin', 'staff', 'facilitator'];
    if (!user || !adminRoles.includes(user.role as string)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { teamId, eventId } = await req.json() as { teamId: string; eventId: string };
    if (!teamId || !eventId) return NextResponse.json({ error: 'Missing teamId or eventId' }, { status: 400 });

    // Fetch team + project + screenshots
    const [{ data: team }, { data: project }, { data: screenshots }] = await Promise.all([
      supabase.from('hackathon_teams').select('id, name, event_id').eq('id', teamId).eq('event_id', eventId).single(),
      supabase.from('hackathon_projects').select('*').eq('team_id', teamId).maybeSingle(),
      supabase.from('hackathon_project_screenshots').select('file_url, sort_order').eq('team_id', teamId).order('sort_order'),
    ]);

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    if (!project?.repo_url) return NextResponse.json({ error: 'Team has not submitted a repo URL' }, { status: 400 });

    // Check minimum pool size (at least 4 projects submitted)
    const { count: submittedCount } = await supabase
      .from('hackathon_projects')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('submitted_at', 'is', null)
      .not('repo_url', 'is', null);

    if ((submittedCount ?? 0) < 4) {
      return NextResponse.json(
        { error: `Need at least 4 submitted projects to run AI analysis. Currently ${submittedCount ?? 0}.` },
        { status: 422 }
      );
    }

    // Check if analysis is already running
    const { data: existing } = await supabase
      .from('hackathon_ai_analyses')
      .select('status')
      .eq('team_id', teamId)
      .eq('pass_name', 'pass1_repo')
      .maybeSingle();

    if (existing?.status === 'running') {
      return NextResponse.json({ error: 'Analysis already running for this team' }, { status: 409 });
    }

    const screenshotUrls = (screenshots ?? []).map((s: { file_url: string }) => s.file_url);

    // Fire and forget — pipeline runs in background on Render (persistent server)
    void runAnalysisPipeline({
      teamId,
      eventId,
      teamName: team.name as string,
      repoUrl: project.repo_url as string,
      pitchText: (project.description as string | null) ?? null,
      screenshotUrls,
    });

    return NextResponse.json({ status: 'started' }, { status: 202 });
  } catch (e) {
    console.error('[analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
