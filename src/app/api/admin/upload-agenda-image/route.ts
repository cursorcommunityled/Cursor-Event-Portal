import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
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
    // Auth first (uses headers — won't consume the body so we can still read formData).
    // Accepts Supabase auth, portal_session admin user, or per-event admin code
    // via `x-admin-code` + `x-event-id` headers.
    const headerEventId = request.headers.get("x-event-id") ?? undefined;
    const auth = await requireAdmin(request, { eventId: headerEventId });
    if ("response" in auth) return auth.response;

    const supabase = await createServiceClient();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const eventId = (formData.get("eventId") as string | null) ?? headerEventId ?? null;

    if (!file || !eventId) {
      return NextResponse.json({ error: "Missing file or eventId" }, { status: 400 });
    }

    if (!isAllowedImage(file)) {
      return NextResponse.json({ error: "Only image files are supported" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 20MB limit" },
        { status: 400 }
      );
    }

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      return NextResponse.json(
        { error: `Storage access error: ${bucketError.message}` },
        { status: 500 }
      );
    }

    const bucket = buckets?.find((item) => item.name === "agenda-images");
    if (!bucket) {
      const { error: createError } = await supabase.storage.createBucket("agenda-images", { public: true });
      if (createError) {
        return NextResponse.json(
          { error: `Storage bucket 'agenda-images' not found and could not be created: ${createError.message}` },
          { status: 500 }
        );
      }
    } else if (!bucket.public) {
      await supabase.storage.updateBucket("agenda-images", { public: true });
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${eventId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("agenda-images")
      .upload(filePath, file, {
        contentType: file.type || "image/png",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload image: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("agenda-images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error("[upload-agenda-image] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
