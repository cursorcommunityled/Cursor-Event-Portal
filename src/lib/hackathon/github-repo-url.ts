/**
 * Shared GitHub repo URL validation for hackathon project submissions.
 */

export type ParsedGithubRepoUrl = {
  normalized: string;
  owner: string;
  repo: string;
};

/** Returns a normalized https://github.com/owner/repo URL or null if invalid. */
export function parsePublicGithubRepoUrl(input: string | null | undefined): ParsedGithubRepoUrl | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "github.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;

  return {
    owner,
    repo,
    normalized: `https://github.com/${owner}/${repo}`,
  };
}

export function isValidPublicGithubRepoUrl(input: string | null | undefined): boolean {
  return parsePublicGithubRepoUrl(input) != null;
}

export function submissionPayloadFingerprint(data: {
  name: string;
  description: string | null;
  repoUrl: string;
  demoUrl: string | null;
}): string {
  return [
    data.name.trim().toLowerCase(),
    (data.description ?? "").trim().toLowerCase(),
    data.repoUrl.trim().toLowerCase().replace(/\/$/, "").replace(/\.git$/i, ""),
    (data.demoUrl ?? "").trim().toLowerCase().replace(/\/$/, ""),
  ].join("\n");
}
