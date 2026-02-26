import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
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
    const competitionId = formData.get("competitionId") as string | null;

    if (!file || !eventId || !competitionId) {
      return NextResponse.json(
        { error: "Missing file, eventId, or competitionId" },
        { status: 400 }
      );
    }

    if (!isAllowedImage(file)) {
      return NextResponse.json(
        { error: "Only image files are supported (PNG, JPEG, WebP, GIF)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Competition must exist and be active for submissions
    const { data: competition, error: compError } = await supabase
      .from("competitions")
      .select("id, status, event_id")
      .eq("id", competitionId)
      .eq("event_id", eventId)
      .single();

    if (compError || !competition || competition.status !== "active") {
      return NextResponse.json(
        { error: "Competition not found or not accepting submissions" },
        { status: 400 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${eventId}/${competitionId}/${session.userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("competition-previews")
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
      .from("competition-previews")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (err) {
    console.error("[competition-upload-preview] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
