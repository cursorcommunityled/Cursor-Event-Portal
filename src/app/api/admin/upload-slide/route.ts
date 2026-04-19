import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/registration";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
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

    const supabase = await createServiceClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .single();

    if (userError) {
      console.error("[upload-slide] Error fetching user role");
    }

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const eventId = formData.get("eventId") as string | null;

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
      console.error("[upload-slide] Bucket list error:", bucketError.message);
      return NextResponse.json(
        { error: "Storage is unavailable. Please try again." },
        { status: 500 }
      );
    }

    const bucket = buckets?.find((item) => item.name === "slides");
    if (!bucket) {
      const { error: createError } = await supabase.storage.createBucket("slides", { public: true });
      if (createError) {
        console.error("[upload-slide] Bucket create error:", createError.message);
        return NextResponse.json(
          { error: "Storage bucket could not be initialised." },
          { status: 500 }
        );
      }
    } else if (!bucket.public) {
      await supabase.storage.updateBucket("slides", { public: true });
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${eventId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("slides")
      .upload(filePath, file, {
        contentType: file.type || "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[upload-slide] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Failed to upload slide." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("slides")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      slides: [
        {
          url: urlData.publicUrl,
          path: filePath,
        },
      ],
    });
  } catch (error) {
    console.error("[upload-slide] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
