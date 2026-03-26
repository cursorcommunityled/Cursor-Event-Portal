import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const caption = formData.get("caption") as string | null;
    const autoApprove = formData.get("autoApprove") === "true";

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
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

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${headerEventId}/admin/${Date.now()}-${safeName}`;

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
        event_id: headerEventId,
        uploaded_by: null,
        file_url: urlData.publicUrl,
        storage_path: filePath,
        caption: caption?.trim() || null,
        status: autoApprove ? "approved" : "pending",
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

    return NextResponse.json({ success: true, photo });
  } catch (err) {
    console.error("[admin/upload-event-photo] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
