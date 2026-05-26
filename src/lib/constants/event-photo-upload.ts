export const EVENT_PHOTO_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const EVENT_PHOTO_MAX_SIZE_MB = 20;

export function eventPhotoSizeLimitError(fileName?: string) {
  const prefix = fileName ? `${fileName}: ` : "";
  return `${prefix}exceeds ${EVENT_PHOTO_MAX_SIZE_MB}MB limit`;
}
