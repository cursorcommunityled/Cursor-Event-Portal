import type { RepoData, RepoFile } from '../types';

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

async function ghFetchOnce(path: string, token?: string): Promise<Response> {
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

async function ghFetch(path: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res = await ghFetchOnce(path, token);

    // Invalid token: retry once without auth for public repos only.
    if (token && res.status === 401 && attempt === 0) {
      res = await ghFetchOnce(path);
    }

    if (res.ok || (res.status !== 403 && res.status !== 429)) {
      return res;
    }

    let message = res.statusText;
    try {
      const data = await res.clone().json() as { message?: string };
      if (data.message) message = data.message;
    } catch {
      // keep status text
    }

    if (!isRateLimitedResponse(res, message) || attempt === maxAttempts - 1) {
      return res;
    }

    const resetHeader = res.headers.get('x-ratelimit-reset');
    const resetMs = resetHeader ? Number(resetHeader) * 1000 - Date.now() : 0;
    const waitMs = Math.min(Math.max(resetMs, 2_000), 120_000);
    await sleep(waitMs);
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

  const tokenHint = !process.env.GITHUB_TOKEN?.trim() && /rate limit/i.test(message)
    ? ' Set GITHUB_TOKEN on the server for 5,000 requests/hour instead of 60.'
    : '';

  return new Error(`GitHub repo fetch failed for ${repo}: ${res.status} ${message}.${rateLimit}${tokenHint}`);
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
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

  // Fetch in parallel where possible
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

  // Filter commits to hackathon window (last 48 hrs or since hackathon date)
  const cutoff = hackathonDate
    ? new Date(hackathonDate).getTime() - 48 * 60 * 60 * 1000
    : Date.now() - 48 * 60 * 60 * 1000;

  const windowCommits = allCommits.filter(
    (c) => new Date(c.commit.author.date).getTime() >= cutoff
  );
  const commitAuthors = [...new Set(windowCommits.map((c) => c.commit.author.name))];

  // Get default branch tree
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

  // Template detection
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

  // Detect tech stack from languages + filenames
  const tech_stack: string[] = Object.keys(languages);
  if (allPaths.some((p) => p.includes('supabase'))) tech_stack.push('Supabase');
  if (allPaths.some((p) => p.includes('prisma'))) tech_stack.push('Prisma');
  if (allPaths.some((p) => p.includes('openai') || p.includes('anthropic'))) tech_stack.push('LLM');
  if (allPaths.some((p) => p.endsWith('.ipynb'))) tech_stack.push('Jupyter');

  // README
  const readmeRes = await ghFetch(`/repos/${owner}/${repo}/readme`);
  let readme = '';
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    if (readmeData.content) {
      readme = Buffer.from(readmeData.content, 'base64').toString('utf-8').slice(0, 3000);
    }
  }

  // Fetch up to 15 interesting source files (batched to avoid GitHub rate-limit bursts)
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
