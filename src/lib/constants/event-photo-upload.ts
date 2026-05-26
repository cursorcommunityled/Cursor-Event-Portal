export const EVENT_PHOTO_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const EVENT_PHOTO_MAX_SIZE_MB = 20;

export const EVENT_PHOTO_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
] as const;

export const EVENT_PHOTO_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export function eventPhotoSizeLimitError(fileName?: string) {
  const prefix = fileName ? `${fileName}: ` : "";
  return `${prefix}exceeds ${EVENT_PHOTO_MAX_SIZE_MB}MB limit`;
}

export function isHeicFileName(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

export function isEventPhotoImageFile(name: string, type?: string | null) {
  if (type && EVENT_PHOTO_IMAGE_TYPES.includes(type as (typeof EVENT_PHOTO_IMAGE_TYPES)[number])) {
    return true;
  }
  const lower = name.toLowerCase();
  return EVENT_PHOTO_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function getEventPhotoMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

export function toJpegFileName(name: string) {
  return name.replace(/\.(heic|heif)$/i, ".jpg");
}
