import type { RepoData, RepoFile } from '../types';
import { GITHUB_CALLS_PER_TEAM } from '../constants';

const GITHUB_API = 'https://api.github.com';
const BOILERPLATE_FILES = new Set([
  '.gitignore', 'LICENSE', 'README.md', 'README.mdx', '.eslintrc', '.eslintrc.js',
  '.eslintrc.json', '.prettierrc', 'prettier.config.js', 'tsconfig.json',
  'next.config.js', 'next.config.ts', 'next.config.mjs', 'tailwind.config.js',
  'tailwind.config.ts', 'postcss.config.js', 'postcss.config.mjs',
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'vite.config.ts', 'vite.config.js', '.env.example', '.env.local',
]);

const BOILERPLATE_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', '.turbo',
  '__pycache__', '.pytest_cache', 'venv', '.venv',
]);

function isBoilerplate(path: string): boolean {
  const parts = path.split('/');
  if (parts.some((p) => BOILERPLATE_DIRS.has(p))) return true;
  const file = parts[parts.length - 1];
  return BOILERPLATE_FILES.has(file);
}

function isInteresting(path: string): boolean {
  if (isBoilerplate(path)) return false;
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') ||
    lower.endsWith('.jsx') || lower.endsWith('.py') || lower.endsWith('.go') ||
    lower.endsWith('.rs') || lower.endsWith('.rb') || lower.endsWith('.java') ||
    lower.endsWith('.cs') || lower.endsWith('.cpp') || lower.endsWith('.c') ||
    lower.endsWith('.swift') || lower.endsWith('.kt') || lower.endsWith('.sql')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitedResponse(res: Response, message: string) {
  return (
    res.status === 429 ||
    (res.status === 403 && /rate limit/i.test(message)) ||
    res.headers.get('x-ratelimit-remaining') === '0'
  );
}

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    msg.includes('abort') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('socket')
  );
}

async function ghFetchOnce(path: string, token?: string): Promise<Response> {
  if (!path.startsWith('/') || path.includes('://') || path.includes('\\')) {
    throw new Error('Invalid GitHub API path');
  }
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cursor-popup-portal/1.0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    return await fetch(`${GITHUB_API}${path}`, {
      headers,
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export type GithubRateLimitInfo = {
  limit: number;
  remaining: number;
  reset: number;
  authenticated: boolean;
};

/** Fresh rate-limit probe (not process-cached) for admin ops / Analyze All budget. */
export async function getGithubRateLimit(): Promise<GithubRateLimitInfo> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return { limit: 60, remaining: 0, reset: 0, authenticated: false };
  }

  const res = await ghFetchOnce('/rate_limit', token);
  if (res.status === 401) {
    throw new Error(
      'GITHUB_TOKEN is invalid or expired (GitHub returned 401 Bad credentials). ' +
        'Update GITHUB_TOKEN on Render with a fresh PAT and restart the service.'
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub rate_limit probe failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    resources?: { core?: { remaining?: number; limit?: number; reset?: number } };
  };
  const core = data.resources?.core;
  return {
    limit: core?.limit ?? 0,
    remaining: core?.remaining ?? 0,
    reset: core?.reset ?? 0,
    authenticated: (core?.limit ?? 0) >= 1000,
  };
}

/**
 * Block Analyze All when remaining budget cannot cover pending teams.
 * Requires remaining >= pendingTeams * 20 + 100.
 */
export async function ensureGithubBudget(pendingTeams: number): Promise<GithubRateLimitInfo> {
  await ensureGithubAccess();
  const info = await getGithubRateLimit();
  const needed = pendingTeams * GITHUB_CALLS_PER_TEAM + 100;
  if (info.remaining < needed) {
    const resetAt = info.reset
      ? new Date(info.reset * 1000).toLocaleString()
      : 'later';
    throw new Error(
      `GitHub rate limit too low for ${pendingTeams} team(s): ` +
        `${info.remaining}/${info.limit} remaining, need ~${needed}. ` +
        `Resets at ${resetAt}. Wait or reduce concurrent Analyze All.`
    );
  }
  return info;
}

/** Cached once per process so Analyze All doesn't re-probe GitHub each team. */
let githubAuthProbe: Promise<'ok' | 'missing' | 'invalid'> | null = null;

/**
 * Verify GITHUB_TOKEN before AI screening burns the unauthenticated 60 req/hr quota.
 */
export async function ensureGithubAccess(): Promise<void> {
  if (!githubAuthProbe) {
    githubAuthProbe = (async () => {
      const token = process.env.GITHUB_TOKEN?.trim();
      if (!token) return 'missing' as const;

      try {
        const res = await ghFetchOnce('/rate_limit', token);
        if (res.status === 401) return 'invalid' as const;
        if (!res.ok) return 'ok' as const;

        try {
          const data = await res.json() as {
            resources?: { core?: { remaining?: number; limit?: number; reset?: number } };
          };
          const core = data.resources?.core;
          if (core && typeof core.remaining === 'number' && core.remaining < 100) {
            const resetAt = core.reset
              ? new Date(core.reset * 1000).toLocaleString()
              : 'soon';
            console.warn(
              `[github] Rate limit low: ${core.remaining}/${core.limit ?? '?'} remaining (resets ${resetAt})`
            );
          }
        } catch {
          // ignore parse errors
        }
        return 'ok' as const;
      } catch (e) {
        if (isNetworkError(e)) return 'ok' as const;
        throw e;
      }
    })();
  }

  const status = await githubAuthProbe;
  if (status === 'missing') {
    throw new Error(
      'GITHUB_TOKEN is not set on the server. Without it GitHub allows only ~60 requests/hour ' +
        `(AI screening uses ~${GITHUB_CALLS_PER_TEAM} per team). Set a valid personal access token on Render and redeploy.`
    );
  }
  if (status === 'invalid') {
    githubAuthProbe = null;
    throw new Error(
      'GITHUB_TOKEN is invalid or expired (GitHub returned 401 Bad credentials). ' +
        'Update GITHUB_TOKEN on Render with a fresh PAT and restart the service — ' +
        'do not run Analyze All until this is fixed (unauthenticated fallback hits the 60 req/hr cap).'
    );
  }
}

async function ghFetch(path: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await ghFetchOnce(path, token);
    } catch (error) {
      if (!isNetworkError(error) || attempt === maxAttempts - 1) throw error;
      await sleep((attempt + 1) ** 2 * 1000);
      continue;
    }

    // Do NOT silently fall back to unauthenticated requests when a token is configured.
    if (token && res.status === 401) {
      return res;
    }

    if (res.ok) return res;

    let message = res.statusText;
    try {
      const data = await res.clone().json() as { message?: string };
      if (data.message) message = data.message;
    } catch {
      // keep status text
    }

    const rateLimited = isRateLimitedResponse(res, message);
    const retryableHttp = isRetryableHttpStatus(res.status);

    if ((!rateLimited && !retryableHttp) || attempt === maxAttempts - 1) {
      return res;
    }

    if (rateLimited) {
      const resetHeader = res.headers.get('x-ratelimit-reset');
      const resetMs = resetHeader ? Number(resetHeader) * 1000 - Date.now() : 0;
      const waitMs = Math.min(Math.max(resetMs, 2_000), 120_000);
      await sleep(waitMs);
    } else {
      await sleep((attempt + 1) ** 2 * 1000);
    }
  }

  return await ghFetchOnce(path, token);
}

async function githubError(res: Response, repo: string): Promise<Error> {
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  let message = res.statusText;

  try {
    const data = await res.json() as { message?: string };
    if (data.message) message = data.message;
  } catch {
    // GitHub did not return JSON; keep the HTTP status text.
  }

  const rateLimit = remaining === '0' && reset
    ? ` GitHub rate limit resets at ${new Date(Number(reset) * 1000).toLocaleString()}.`
    : '';

  const token = process.env.GITHUB_TOKEN?.trim();
  let tokenHint = '';
  if (res.status === 401 && token) {
    tokenHint = ' GITHUB_TOKEN looks invalid/expired — rotate it on Render and restart.';
  } else if (!token && /rate limit/i.test(message)) {
    tokenHint = ' Set GITHUB_TOKEN on the server for 5,000 requests/hour instead of 60.';
  }

  return new Error(`GitHub repo fetch failed for ${repo}: ${res.status} ${message}.${rateLimit}${tokenHint}`);
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts[0].includes('..') || parts[1].includes('..')) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

export async function fetchRepoData(repoUrl: string, hackathonDate?: string): Promise<RepoData | null> {
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) return null;
  const { owner, repo } = parsed;
  const repoName = `${owner}/${repo}`;

  const [repoRes, langsRes, commitsRes] = await Promise.all([
    ghFetch(`/repos/${owner}/${repo}`),
    ghFetch(`/repos/${owner}/${repo}/languages`),
    ghFetch(`/repos/${owner}/${repo}/commits?per_page=100`),
  ]);

  if (!repoRes.ok) throw await githubError(repoRes, repoName);
  const repoMeta = await repoRes.json();

  const languages: Record<string, number> = langsRes.ok ? await langsRes.json() : {};
  const allCommits: { commit: { author: { name: string; date: string } } }[] =
    commitsRes.ok ? await commitsRes.json() : [];

  const cutoff = hackathonDate
    ? new Date(hackathonDate).getTime() - 48 * 60 * 60 * 1000
    : Date.now() - 48 * 60 * 60 * 1000;

  const windowCommits = allCommits.filter(
    (c) => new Date(c.commit.author.date).getTime() >= cutoff
  );
  const commitAuthors = [...new Set(windowCommits.map((c) => c.commit.author.name))];

  const defaultBranch = repoMeta.default_branch ?? 'main';
  const treeRes = await ghFetch(`/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
  const treeData = treeRes.ok ? await treeRes.json() : { tree: [] };
  const allPaths: string[] = (treeData.tree ?? [])
    .filter((f: { type: string }) => f.type === 'blob')
    .map((f: { path: string }) => f.path)
    .slice(0, 500);

  const sourcePaths = allPaths.filter(isInteresting);
  const originalCodeRatio = allPaths.length > 0
    ? sourcePaths.length / Math.max(allPaths.length, 1)
    : 0;

  let templateDetected: string | null = null;
  if (allPaths.includes('src/app/page.tsx') || allPaths.includes('app/page.tsx')) {
    templateDetected = 'next-starter';
  } else if (allPaths.includes('src/App.tsx') && allPaths.includes('public/index.html')) {
    templateDetected = 'create-react-app';
  } else if (allPaths.includes('app.py') && allPaths.includes('requirements.txt')) {
    templateDetected = 'flask-template';
  } else if (allPaths.includes('vite.config.ts') || allPaths.includes('vite.config.js')) {
    templateDetected = 'vite-react';
  }

  const tech_stack: string[] = Object.keys(languages);
  if (allPaths.some((p) => p.includes('supabase'))) tech_stack.push('Supabase');
  if (allPaths.some((p) => p.includes('prisma'))) tech_stack.push('Prisma');
  if (allPaths.some((p) => p.includes('openai') || p.includes('anthropic'))) tech_stack.push('LLM');
  if (allPaths.some((p) => p.endsWith('.ipynb'))) tech_stack.push('Jupyter');

  const readmeRes = await ghFetch(`/repos/${owner}/${repo}/readme`);
  let readme = '';
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    if (readmeData.content) {
      readme = Buffer.from(readmeData.content, 'base64').toString('utf-8').slice(0, 3000);
    }
  }

  const toFetch = sourcePaths.slice(0, 15);
  const keyFiles: RepoFile[] = [];
  const batchSize = 3;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (filePath) => {
        const res = await ghFetch(`/repos/${owner}/${repo}/contents/${filePath}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.content) return;
        const content = Buffer.from(data.content, 'base64').toString('utf-8').slice(0, 2000);
        keyFiles.push({ path: filePath, content });
      })
    );
  }

  return {
    owner,
    repo,
    is_forked: repoMeta.fork ?? false,
    file_count: allPaths.length,
    languages,
    tech_stack: [...new Set(tech_stack)],
    template_detected: templateDetected,
    original_code_ratio: parseFloat(originalCodeRatio.toFixed(2)),
    commit_count_in_window: windowCommits.length,
    commit_authors: commitAuthors,
    readme,
    key_files: keyFiles,
    file_tree: allPaths.slice(0, 200),
  };
}
