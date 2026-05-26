import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  EVENT_PHOTO_MAX_SIZE_BYTES,
  eventPhotoSizeLimitError,
} from "@/lib/constants/event-photo-upload";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function isAllowedImage(name: string, contentType?: string | null) {
  if (contentType && ALLOWED_TYPES.has(contentType)) return true;
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  );
}

function getContentType(name: string, contentType?: string | null) {
  if (contentType && ALLOWED_TYPES.has(contentType)) return contentType;
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
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

    const body = await request.json();
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : null;
    const size = typeof body.size === "number" ? body.size : 0;

    if (!fileName) {
      return NextResponse.json({ error: "Missing file name" }, { status: 400 });
    }

    if (!isAllowedImage(fileName, contentType)) {
      return NextResponse.json(
        { error: "Only image files are supported (PNG, JPEG, WebP, GIF)" },
        { status: 400 }
      );
    }

    if (size > EVENT_PHOTO_MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: eventPhotoSizeLimitError() },
        { status: 400 }
      );
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${headerEventId}/admin/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const resolvedContentType = getContentType(fileName, contentType);

    const { data: signedUpload, error: signError } = await supabase.storage
      .from("event-photos")
      .createSignedUploadUrl(filePath);

    if (signError || !signedUpload) {
      return NextResponse.json(
        { error: `Failed to prepare upload: ${signError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("event-photos")
      .getPublicUrl(filePath);

    return NextResponse.json({
      bucket: "event-photos",
      path: filePath,
      token: signedUpload.token,
      publicUrl: urlData.publicUrl,
      contentType: resolvedContentType,
    });
  } catch (err) {
    console.error("[admin/event-photo-upload/sign] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
