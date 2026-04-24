/**
 * Read a browser File into a Blob safely.
 *
 * `file.arrayBuffer()` can throw a `NotFoundError` DOMException
 * ("A requested file or directory could not be found at the time an
 * operation was processed") when the underlying file is no longer
 * accessible — usually because:
 *   - The file lives in OneDrive / iCloud / Drive File Stream with
 *     "files-on-demand" and isn't actually downloaded locally yet.
 *   - The OS / antivirus quarantined or rewrote the file between
 *     selection and read.
 *   - A sync agent moved/renamed the file (Screenshots, Camera Roll, ...).
 *
 * This helper:
 *   1. Tries `file.arrayBuffer()` (fast, modern path).
 *   2. Falls back to `FileReader.readAsArrayBuffer()` which sometimes
 *      succeeds because it goes through a different OS code path.
 *   3. Throws a clear, actionable Error if both fail.
 */
export async function readFileToBlob(file: File): Promise<Blob> {
  try {
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], { type: file.type });
  } catch (primaryErr) {
    try {
      const buffer = await readViaFileReader(file);
      return new Blob([buffer], { type: file.type });
    } catch (fallbackErr) {
      const detail =
        primaryErr instanceof Error
          ? primaryErr.message
          : String(primaryErr);
      throw new Error(
        `Couldn't read "${file.name}" from disk. ` +
          `If it's stored in OneDrive, iCloud, or another cloud sync folder, ` +
          `right-click it in File Explorer and choose "Always keep on this device" ` +
          `(or copy it to your Desktop) and try again. (${detail})`
      );
    }
  }
}

function readViaFileReader(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader returned non-ArrayBuffer result"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsArrayBuffer(file);
  });
}
