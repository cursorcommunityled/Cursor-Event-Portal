import { NextRequest, NextResponse } from "next/server";
import { withMobileSession } from "@/lib/auth/mobile-session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  return withMobileSession(request, async (session) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const caption = (formData.get("caption") as string | null) ?? null;

      if (!file) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }

      const supabase = await createServiceClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${session.eventId}/${session.userId}/${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(path, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("[mobile/upload/photo]", uploadError);
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("event-photos").getPublicUrl(path);

      const { data: photo, error: insertError } = await supabase
        .from("event_photos")
        .insert({
          event_id: session.eventId,
          user_id: session.userId,
          storage_path: path,
          url: publicUrl,
          caption,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, photo });
    } catch (error) {
      console.error("[mobile/upload/photo]", error);
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }
  });
}
