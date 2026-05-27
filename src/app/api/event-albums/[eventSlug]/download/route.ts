import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

import { pastEvents } from "@/content/events";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const EVENT_GALLERY_PHOTO_USAGE = "event_gallery";
const EVENT_PHOTOS_BUCKET = "event-photos";

type AlbumPhoto = {
  id: string;
  storage_path: string;
  file_url: string;
  created_at: string;
};

function slugifyFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event-album";
}

function safePhotoFileName(sourcePath: string, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  const rawName = sourcePath.split("/").pop() || fallback;
  const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || fallback;
  return `${String(index + 1).padStart(3, "0")}-${cleanName}`;
}

async function addSupabasePhotosToZip(zip: JSZip, photos: AlbumPhoto[]) {
  const supabase = await createServiceClient();
  let added = 0;

  for (const [index, photo] of photos.entries()) {
    const { data, error } = await supabase.storage
      .from(EVENT_PHOTOS_BUCKET)
      .download(photo.storage_path);

    if (error || !data) {
      console.warn("[event-albums/download] Skipping unavailable photo", {
        photoId: photo.id,
        storagePath: photo.storage_path,
        error: error?.message,
      });
      continue;
    }

    zip.file(safePhotoFileName(photo.storage_path, index), await data.arrayBuffer());
    added += 1;
  }

  return added;
}

async function addStaticPhotosToZip(zip: JSZip, photoPaths: string[]) {
  let added = 0;

  for (const [index, photoPath] of photoPaths.entries()) {
    if (!photoPath.startsWith("/")) continue;

    const publicPath = photoPath.replace(/^\/+/, "");
    if (publicPath.includes("..")) continue;

    try {
      const file = await readFile(path.join(process.cwd(), "public", publicPath));
      zip.file(safePhotoFileName(publicPath, index), file);
      added += 1;
    } catch (error) {
      console.warn("[event-albums/download] Skipping unavailable static photo", {
        photoPath,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return added;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventSlug: string } }
) {
  const eventSlug = decodeURIComponent(params.eventSlug);

  try {
    const supabase = await createServiceClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, slug, name")
      .eq("slug", eventSlug)
      .maybeSingle();

    const zip = new JSZip();
    let zipBaseName = eventSlug;
    let addedPhotos = 0;

    if (event) {
      zipBaseName = event.slug || event.name || eventSlug;

      const { data: photos, error: photosError } = await supabase
        .from("event_photos")
        .select("id, storage_path, file_url, created_at")
        .eq("event_id", event.id)
        .eq("photo_usage", EVENT_GALLERY_PHOTO_USAGE)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (photosError) {
        console.error("[event-albums/download] Failed to load album photos", photosError);
        return NextResponse.json({ error: "Failed to load album photos" }, { status: 500 });
      }

      addedPhotos = await addSupabasePhotosToZip(zip, (photos ?? []) as AlbumPhoto[]);
    } else {
      const staticEvent = pastEvents.find((pastEvent) => pastEvent.id === eventSlug);
      const staticPhotos = [
        staticEvent?.thumbnail,
        ...(staticEvent?.galleryImages ?? []),
      ].filter((photoPath): photoPath is string => Boolean(photoPath));

      if (staticEvent) {
        zipBaseName = staticEvent.title || staticEvent.id;
      }

      addedPhotos = await addStaticPhotosToZip(zip, staticPhotos);
    }

    if (addedPhotos === 0) {
      return NextResponse.json({ error: "No album photos found" }, { status: 404 });
    }

    const zipBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "STORE",
    });
    const zipFileName = `${slugifyFilePart(zipBaseName)}-album.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "Content-Length": String(zipBuffer.byteLength),
        "Content-Type": "application/zip",
      },
    });
  } catch (error) {
    console.error("[event-albums/download] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build album download" },
      { status: 500 }
    );
  }
}
