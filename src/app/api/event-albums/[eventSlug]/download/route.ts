import { once } from "node:events";
import { createReadStream } from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import archiver, { type Archiver } from "archiver";
import { NextRequest, NextResponse } from "next/server";

import { pastEvents } from "@/content/events";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const EVENT_GALLERY_PHOTO_USAGE = "event_gallery";

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

async function appendArchiveEntry(
  archive: Archiver,
  input: Readable,
  name: string
) {
  const entryCompleted = once(archive, "entry");
  archive.append(input, { name });
  await entryCompleted;
}

async function appendRemotePhoto(archive: Archiver, photo: AlbumPhoto, index: number) {
  const response = await fetch(photo.file_url, { cache: "no-store" });

  if (!response.ok || !response.body) {
    console.warn("[event-albums/download] Skipping unavailable photo", {
      photoId: photo.id,
      storagePath: photo.storage_path,
      status: response.status,
    });
    return;
  }

  const nodeStream = Readable.fromWeb(
    response.body as unknown as NodeReadableStream<Uint8Array>
  );
  await appendArchiveEntry(archive, nodeStream, safePhotoFileName(photo.storage_path, index));
}

async function appendStaticPhoto(archive: Archiver, photoPath: string, index: number) {
  if (!photoPath.startsWith("/")) return;

  const publicPath = photoPath.replace(/^\/+/, "");
  if (publicPath.includes("..")) return;

  await appendArchiveEntry(
    archive,
    createReadStream(path.join(process.cwd(), "public", publicPath)),
    safePhotoFileName(publicPath, index)
  );
}

async function finalizeAlbumArchive(
  archive: Archiver,
  sources: { photos: AlbumPhoto[] } | { staticPhotos: string[] }
) {
  if ("photos" in sources) {
    for (const [index, photo] of sources.photos.entries()) {
      await appendRemotePhoto(archive, photo, index);
    }
  } else {
    for (const [index, photoPath] of sources.staticPhotos.entries()) {
      await appendStaticPhoto(archive, photoPath, index);
    }
  }

  await archive.finalize();
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

    let zipBaseName = eventSlug;
    let sources: { photos: AlbumPhoto[] } | { staticPhotos: string[] } | null = null;

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

      sources = { photos: (photos ?? []) as AlbumPhoto[] };
    } else {
      const staticEvent = pastEvents.find((pastEvent) => pastEvent.id === eventSlug);
      const staticPhotos = [
        staticEvent?.thumbnail,
        ...(staticEvent?.galleryImages ?? []),
      ].filter((photoPath): photoPath is string => Boolean(photoPath));

      if (staticEvent) {
        zipBaseName = staticEvent.title || staticEvent.id;
      }

      sources = { staticPhotos };
    }

    const photoCount = sources
      ? "photos" in sources
        ? sources.photos.length
        : sources.staticPhotos.length
      : 0;

    if (!sources || photoCount === 0) {
      return NextResponse.json({ error: "No album photos found" }, { status: 404 });
    }

    const output = new PassThrough();
    const archive = archiver("zip", {
      forceZip64: true,
      store: true,
    });
    const zipFileName = `${slugifyFilePart(zipBaseName)}-album.zip`;

    archive.on("warning", (error) => {
      console.warn("[event-albums/download] Archive warning:", error);
    });
    archive.on("error", (error) => {
      console.error("[event-albums/download] Archive stream error:", error);
      output.destroy(error);
    });
    archive.pipe(output);

    void finalizeAlbumArchive(archive, sources).catch((error) => {
      console.error("[event-albums/download] Failed while streaming album:", error);
      output.destroy(error);
    });

    return new NextResponse(Readable.toWeb(output) as ReadableStream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
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
