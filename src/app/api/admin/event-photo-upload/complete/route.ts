import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const adminCode = request.headers.get("x-admin-code");
    const headerEventId = request.headers.get("x-event-id");

    if (!adminCode || !headerEventId) {
      return NextResponse.json({ error: "Missing admin credentials" }, { status: 401 });
    }

    const { data: event } = await supabase
      .from("events")
      .select("id, admin_code")
      .eq("id", headerEventId)
      .single();

    if (!event || event.admin_code !== adminCode) {
      return NextResponse.json({ error: "Invalid admin code" }, { status: 403 });
    }

    const body = await request.json();
    const storagePath = typeof body.path === "string" ? body.path : "";
    const publicUrl = typeof body.publicUrl === "string" ? body.publicUrl : "";
    const caption = typeof body.caption === "string" ? body.caption : null;
    const autoApprove = body.autoApprove === true;

    if (!storagePath || !storagePath.startsWith(`${headerEventId}/admin/`)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }

    const resolvedUrl = publicUrl || supabase.storage
      .from("event-photos")
      .getPublicUrl(storagePath).data.publicUrl;

    const { data: photo, error: insertError } = await supabase
      .from("event_photos")
      .insert({
        event_id: headerEventId,
        uploaded_by: null,
        file_url: resolvedUrl,
        storage_path: storagePath,
        caption: caption?.trim() || null,
        photo_usage: "event_gallery",
        status: autoApprove ? "approved" : "pending",
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from("event-photos").remove([storagePath]);
      return NextResponse.json(
        { error: `Failed to save photo record: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, photo });
  } catch (err) {
    console.error("[admin/event-photo-upload/complete] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete upload" },
      { status: 500 }
    );
  }
}
