import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
]);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const eventId = formData.get("eventId") as string | null;
    const channelId = formData.get("channelId") as string | null;

    if (!file || !eventId || !channelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (session.eventId !== eventId) {
      return NextResponse.json({ error: "Not authenticated for this event" }, { status: 403 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: checkedInRegistration } = await supabase
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", session.userId)
      .not("checked_in_at", "is", null)
      .maybeSingle();

    if (!checkedInRegistration) {
      return NextResponse.json({ error: "You must be checked in before using chat" }, { status: 403 });
    }

    // Verify user can access this channel
    const { data: channel } = await supabase
      .from("hackathon_chat_channels")
      .select("id, name, team_id, channel_type, event_id")
      .eq("id", channelId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.team_id) {
      const { data: membership } = await supabase
        .from("hackathon_team_members")
        .select("id")
        .eq("team_id", channel.team_id)
        .eq("user_id", session.userId)
        .limit(1);

      if (!membership?.length) {
        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.userId)
          .maybeSingle();

        const adminRoles = ["admin", "staff", "facilitator"];
        if (!user || !adminRoles.includes(user.role)) {
          return NextResponse.json({ error: "Not a team member" }, { status: 403 });
        }
      }
    }

    if (channel.channel_type === "dm") {
      return NextResponse.json({ error: "Direct messages are disabled" }, { status: 403 });
    }

    const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
    const fileType = isImage ? "image" : "file";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${eventId}/hackathon-chat/${channelId}/${session.userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("event-photos")
      .upload(filePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("event-photos")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      file_url: urlData.publicUrl,
      file_type: fileType,
      file_name: file.name,
      file_size_bytes: file.size,
    });
  } catch (err) {
    console.error("[hackathon/chat-upload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
