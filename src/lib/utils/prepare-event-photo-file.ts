"use client";

import { isHeicFileName, toJpegFileName } from "@/lib/constants/event-photo-upload";

export async function prepareEventPhotoFile(file: File): Promise<File> {
  if (!isHeicFileName(file.name)) return file;

  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) {
    throw new Error(`Failed to convert ${file.name} from HEIC`);
  }

  return new File([blob], toJpegFileName(file.name), { type: "image/jpeg" });
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      response.ok
        ? `Server returned non-JSON response (${response.status})`
        : `Upload request failed (${response.status}): ${snippet || "unknown error"}`
    );
  }
  return response.json() as Promise<T>;
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withUploadRetries<T>(
  operation: () => Promise<T>,
  attempts = 4
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(250 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed after retries");
}
