/** Split a name or email local-part into first/last tokens. */
export function nameParts(value: string): string[] {
  return value
    .trim()
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function titleCasePart(part: string): string {
  if (/^[A-Z0-9]{2,4}$/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function titleCasePersonName(value: string): string {
  return nameParts(value).map(titleCasePart).join(" ");
}

function completeness(value: string): number {
  const parts = nameParts(value);
  if (parts.length === 0) return 0;
  const spaceBonus = /\s/.test(value.trim()) ? 2 : 0;
  return parts.length + spaceBonus;
}

/** Prefer the candidate that already looks like a first + last name. */
export function preferCompleteName(current: string, candidate: string): string {
  const currentValue = current.trim();
  const candidateValue = candidate.trim();
  if (!candidateValue) return currentValue;
  if (!currentValue) return candidateValue;
  const currentScore = completeness(currentValue);
  const candidateScore = completeness(candidateValue);
  if (candidateScore > currentScore) return candidateValue;
  if (currentScore > candidateScore) return currentValue;
  return currentValue.length >= candidateValue.length ? currentValue : candidateValue;
}

function firstNamesMatch(name: string, emailFirst: string): boolean {
  const a = (nameParts(name)[0] ?? "").toLowerCase();
  const b = emailFirst.toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.startsWith(a)) return true;
  if (b.length >= 3 && a.startsWith(b)) return true;
  return false;
}

/**
 * Show a first and last name when we have them.
 * Falls back to the email local-part (edwin.olaez → Edwin Olaez) when the
 * stored name is a single token or a handle.
 */
export function formatGuestDisplayName(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const rawName = (name ?? "").trim();
  const local = (email?.split("@")[0] ?? "").trim();
  const emailParts = nameParts(local);
  const emailFullName = emailParts.length >= 2 ? emailParts.map(titleCasePart).join(" ") : "";

  if (nameParts(rawName).length >= 2) {
    return /\s/.test(rawName) ? rawName : titleCasePersonName(rawName);
  }

  if (rawName && emailParts.length >= 2 && firstNamesMatch(rawName, emailParts[0])) {
    const lastName = emailParts.slice(1).map(titleCasePart).join(" ");
    return `${rawName} ${lastName}`.trim();
  }

  if (emailFullName) return emailFullName;
  return rawName || local || "Guest";
}
