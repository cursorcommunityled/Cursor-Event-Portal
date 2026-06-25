import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runAnalysisPipeline } from '@/lib/hackathon-analysis/pipeline';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServiceClient();

    const { teamId, eventId, adminCode } = await req.json() as { teamId: string; eventId: string; adminCode: string };
    if (!teamId || !eventId || !adminCode) return NextResponse.json({ error: 'Missing teamId, eventId, or adminCode' }, { status: 400 });

    // Authorize via admin_code only — admins operate via the /admin/[adminCode]
    // URL and do not carry an attendee portal_session.
    const { data: adminEvent } = await supabase
      .from('events')
      .select('id')
      .eq('admin_code', adminCode)
      .eq('id', eventId)
      .maybeSingle();
    if (!adminEvent) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    // Fetch team + project + screenshots
    const [{ data: team }, { data: project }, { data: screenshots }, { data: settings }] = await Promise.all([
      supabase.from('hackathon_teams').select('id, name, event_id').eq('id', teamId).eq('event_id', eventId).single(),
      supabase.from('hackathon_projects').select('*').eq('team_id', teamId).maybeSingle(),
      supabase.from('hackathon_project_screenshots').select('file_url, sort_order').eq('team_id', teamId).order('sort_order'),
      supabase.from('hackathon_settings').select('prompt_text').eq('event_id', eventId).maybeSingle(),
    ]);

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    if (!project?.submitted_at || !project.repo_url) return NextResponse.json({ error: 'Team has not submitted a repo URL' }, { status: 400 });

    // Block duplicate pipelines while any pass is still running.
    const { count: runningCount } = await supabase
      .from('hackathon_ai_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'running');

    if ((runningCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Analysis already running for this team. Use Reset if it appears stuck.' },
        { status: 409 }
      );
    }

    const screenshotUrls = (screenshots ?? []).map((s: { file_url: string }) => s.file_url);

    // Fire and forget — pipeline runs in background on Render (persistent server)
    void runAnalysisPipeline({
      teamId,
      eventId,
      teamName: team.name as string,
      repoUrl: project.repo_url as string,
      eventPrompt: (settings?.prompt_text as string | null) ?? null,
      pitchText: (project.description as string | null) ?? null,
      screenshotUrls,
    });

    return NextResponse.json({ status: 'started' }, { status: 202 });
  } catch (e) {
    console.error('[analyze] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
