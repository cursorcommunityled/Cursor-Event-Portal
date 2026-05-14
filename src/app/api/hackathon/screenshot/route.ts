import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/registration';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const MAX_SCREENSHOTS = 5;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;
    const teamId = formData.get('teamId') as string | null;

    if (!file || !eventId || !teamId) {
      return NextResponse.json({ error: 'Missing file, eventId, or teamId' }, { status: 400 });
    }
    if (session.eventId !== eventId) {
      return NextResponse.json({ error: 'Not authenticated for this event' }, { status: 403 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPEG, WebP, or GIF allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Verify team membership
    const { data: membership } = await supabase
      .from('hackathon_team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', session.userId)
      .limit(1);

    if (!membership?.[0]) {
      return NextResponse.json({ error: 'You are not on this team' }, { status: 403 });
    }

    // Check screenshot limit
    const { count } = await supabase
      .from('hackathon_project_screenshots')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if ((count ?? 0) >= MAX_SCREENSHOTS) {
      return NextResponse.json({ error: `Max ${MAX_SCREENSHOTS} screenshots allowed` }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${eventId}/hackathon-screenshots/${teamId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('event-photos')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(filePath);

    const nextSort = count ?? 0;
    const { data: row, error: insertError } = await supabase
      .from('hackathon_project_screenshots')
      .insert({ team_id: teamId, event_id: eventId, file_url: urlData.publicUrl, sort_order: nextSort })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from('event-photos').remove([filePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, screenshot: row });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { screenshotId, teamId } = await request.json() as { screenshotId: string; teamId: string };
    const supabase = await createServiceClient();

    const { data: membership } = await supabase
      .from('hackathon_team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', session.userId)
      .limit(1);
    if (!membership?.[0]) return NextResponse.json({ error: 'Not on team' }, { status: 403 });

    const { error } = await supabase
      .from('hackathon_project_screenshots')
      .delete()
      .eq('id', screenshotId)
      .eq('team_id', teamId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
