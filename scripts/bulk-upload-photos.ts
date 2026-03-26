import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOLDER = process.argv[2];
const EVENT_SLUG = process.argv[3];

const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
if (!FOLDER || !EVENT_SLUG) {
  console.error("Usage: tsx scripts/bulk-upload-photos.ts <folder-path> <event-slug>");
  console.error("Example: tsx scripts/bulk-upload-photos.ts '../Event photos/Cursor Meetup Calgary - March' calgary-march-2026");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isImage(file: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function getMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
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
  } else {
    output = await sharp(buf).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  }

  if (output.length > MAX_UPLOAD_BYTES) {
    output = await sharp(buf).resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer();
  }

  console.log(`  Compressed to ${(output.length / 1024 / 1024).toFixed(1)}MB`);
  return output;
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

  const files = fs.readdirSync(absFolder).filter(isImage).sort();
  console.log(`Found ${files.length} images in ${absFolder}\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(absFolder, file);
    const safeName = file.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${event.id}/admin/${Date.now()}-${safeName}`;

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

      const { data: urlData } = supabase.storage
        .from("event-photos")
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from("event_photos")
        .insert({
          event_id: event.id,
          uploaded_by: null,
          file_url: urlData.publicUrl,
          storage_path: storagePath,
          caption: null,
          status: "approved",
        });

      if (insertError) {
        console.error(`  DB insert failed: ${insertError.message}`);
        await supabase.storage.from("event-photos").remove([storagePath]);
        failed++;
        continue;
      }

      uploaded++;
      console.log(`  Done`);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nResults: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
}

main().catch(console.error);
