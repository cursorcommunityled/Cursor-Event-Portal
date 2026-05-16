import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function isAllowedImage(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const eventId = formData.get("eventId") as string | null;
    const teamId = formData.get("teamId") as string | null;

    if (!file || !eventId || !teamId) {
      return NextResponse.json(
        { error: "Missing file, eventId, or teamId" },
        { status: 400 }
      );
    }

    if (session.eventId !== eventId) {
      return NextResponse.json({ error: "Not authenticated for this event" }, { status: 403 });
    }

    if (!isAllowedImage(file)) {
      return NextResponse.json(
        { error: "Only image files are supported (PNG, JPEG, WebP, GIF)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data: team } = await supabase
      .from("hackathon_teams")
      .select("id, event_id, name, created_by, category")
      .eq("id", teamId)
      .eq("event_id", eventId)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("hackathon_team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", session.userId)
      .limit(1);

    const canUploadAsPendingInviteCreator =
      team.created_by === session.userId && team.category === "pending_invite";

    if (!membership?.[0] && !canUploadAsPendingInviteCreator) {
      return NextResponse.json({ error: "You are not on this team" }, { status: 403 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${eventId}/hackathon-team-icons/${teamId}/${session.userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("event-photos")
      .upload(filePath, file, {
        contentType: file.type || "image/png",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("event-photos")
      .getPublicUrl(filePath);

    const { data: photo, error: insertError } = await supabase
      .from("event_photos")
      .insert({
        event_id: eventId,
        uploaded_by: session.userId,
        file_url: urlData.publicUrl,
        storage_path: filePath,
        caption: `Team icon: ${team.name}`,
        photo_usage: "hackathon_team_icon",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from("event-photos").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to save photo record: ${insertError.message}` },
        { status: 500 }
      );
    }

    const { error: teamUpdateError } = await supabase
      .from("hackathon_teams")
      .update({ icon_photo_id: photo.id, updated_at: new Date().toISOString() })
      .eq("id", teamId)
      .eq("event_id", eventId);

    if (teamUpdateError) {
      await supabase.from("event_photos").delete().eq("id", photo.id);
      await supabase.storage.from("event-photos").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to save team icon: ${teamUpdateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      photo,
    });
  } catch (err) {
    console.error("[hackathon/team-icon] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
