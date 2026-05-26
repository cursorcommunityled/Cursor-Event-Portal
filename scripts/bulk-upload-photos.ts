import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOLDER = process.argv[2];
const EVENT_SLUG = process.argv[3];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
const MANIFEST_NAME = ".upload-manifest.json";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
if (!FOLDER || !EVENT_SLUG) {
  console.error("Usage: tsx scripts/bulk-upload-photos.ts <folder-path> <event-slug>");
  console.error(
    "Example: tsx scripts/bulk-upload-photos.ts '../Event photos/Cursor Hackathon SAIT' calgary-hackathon-sait-may-2026"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type ManifestEntry = {
  fileName: string;
  sha256: string;
  photoId?: string;
  uploadedAt?: string;
};

type UploadManifest = {
  eventSlug: string;
  updatedAt: string;
  files: Record<string, ManifestEntry>;
};

function isImage(file: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function getMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".heic" || ext === ".heif") return "image/heic";
  return "image/jpeg";
}

function safeName(file: string): string {
  return file.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function loadManifest(manifestPath: string, eventSlug: string): UploadManifest {
  if (!fs.existsSync(manifestPath)) {
    return { eventSlug, updatedAt: new Date().toISOString(), files: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as UploadManifest;
    return {
      eventSlug,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      files: parsed.files ?? {},
    };
  } catch {
    return { eventSlug, updatedAt: new Date().toISOString(), files: {} };
  }
}

function saveManifest(manifestPath: string, manifest: UploadManifest) {
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function compressIfNeeded(filePath: string): Promise<Buffer> {
  const buf = fs.readFileSync(filePath);
  if (buf.length <= MAX_UPLOAD_BYTES) return buf;

  console.log(`  Compressing ${path.basename(filePath)} (${(buf.length / 1024 / 1024).toFixed(1)}MB)...`);
  const ext = path.extname(filePath).toLowerCase();

  let output: Buffer;
  if (ext === ".png") {
    output = await sharp(buf).resize({ width: 2400, withoutEnlargement: true }).png({ quality: 80 }).toBuffer();
  } else if (ext === ".webp") {
    output = await sharp(buf).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  } else if (ext === ".heic" || ext === ".heif") {
    output = await sharp(buf).rotate().resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } else {
    output = await sharp(buf).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  }

  if (output.length > MAX_UPLOAD_BYTES) {
    output = await sharp(buf).resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer();
  }

  console.log(`  Compressed to ${(output.length / 1024 / 1024).toFixed(1)}MB`);
  return output;
}

async function getExistingSafeNames(eventId: string): Promise<Set<string>> {
  const names = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("event_photos")
      .select("storage_path")
      .eq("event_id", eventId)
      .eq("photo_usage", "event_gallery")
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn("Could not load existing photos for dedupe:", error.message);
      break;
    }

    for (const row of data ?? []) {
      const base = path.basename(row.storage_path);
      const dash = base.indexOf("-");
      if (dash >= 0) names.add(base.slice(dash + 1));
      names.add(base);
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return names;
}

async function main() {
  const absFolder = path.resolve(FOLDER);
  if (!fs.existsSync(absFolder)) {
    console.error(`Folder not found: ${absFolder}`);
    process.exit(1);
  }

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("slug", EVENT_SLUG)
    .single();

  if (eventErr || !event) {
    console.error(`Event not found for slug "${EVENT_SLUG}":`, eventErr?.message);
    process.exit(1);
  }

  console.log(`Event: ${event.name} (${event.id})`);

  const manifestPath = path.join(absFolder, MANIFEST_NAME);
  const manifest = loadManifest(manifestPath, EVENT_SLUG);
  const existingSafeNames = await getExistingSafeNames(event.id);

  const files = fs.readdirSync(absFolder).filter(isImage).sort();
  console.log(`Found ${files.length} images in ${absFolder}\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(absFolder, file);
    const normalizedSafeName = safeName(file);
    const fileHash = sha256File(filePath);
    const manifestEntry = manifest.files[file];

    if (manifestEntry?.sha256 === fileHash && manifestEntry.photoId) {
      skipped++;
      continue;
    }

    if (existingSafeNames.has(normalizedSafeName)) {
      manifest.files[file] = {
        fileName: file,
        sha256: fileHash,
        photoId: manifestEntry?.photoId,
        uploadedAt: manifestEntry?.uploadedAt ?? new Date().toISOString(),
      };
      skipped++;
      continue;
    }

    const storagePath = `${event.id}/admin/${Date.now()}-${normalizedSafeName}`;

    console.log(`[${i + 1}/${files.length}] ${file}`);

    try {
      const buffer = await compressIfNeeded(filePath);

      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(storagePath, buffer, {
          contentType: getMime(file),
          upsert: false,
        });

      if (uploadError) {
        console.error(`  Upload failed: ${uploadError.message}`);
        failed++;
        continue;
      }

      const { data: urlData } = supabase.storage.from("event-photos").getPublicUrl(storagePath);

      const { data: photo, error: insertError } = await supabase
        .from("event_photos")
        .insert({
          event_id: event.id,
          uploaded_by: null,
          file_url: urlData.publicUrl,
          storage_path: storagePath,
          caption: null,
          photo_usage: "event_gallery",
          status: "approved",
        })
        .select("id")
        .single();

      if (insertError || !photo) {
        console.error(`  DB insert failed: ${insertError?.message ?? "Unknown error"}`);
        await supabase.storage.from("event-photos").remove([storagePath]);
        failed++;
        continue;
      }

      manifest.files[file] = {
        fileName: file,
        sha256: fileHash,
        photoId: photo.id,
        uploadedAt: new Date().toISOString(),
      };
      existingSafeNames.add(normalizedSafeName);
      saveManifest(manifestPath, manifest);
      uploaded++;
      console.log("  Done");
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  saveManifest(manifestPath, manifest);
  console.log(`\nResults: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch(console.error);
