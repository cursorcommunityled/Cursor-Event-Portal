import { createHash, timingSafeEqual } from "crypto";

export function secretEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}
