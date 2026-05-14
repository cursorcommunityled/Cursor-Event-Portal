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

async function ghFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cursor-popup-portal/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(`${GITHUB_API}${path}`, { headers, next: { revalidate: 0 } });
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

  // Fetch in parallel where possible
  const [repoRes, langsRes, commitsRes] = await Promise.all([
    ghFetch(`/repos/${owner}/${repo}`),
    ghFetch(`/repos/${owner}/${repo}/languages`),
    ghFetch(`/repos/${owner}/${repo}/commits?per_page=100`),
  ]);

  if (!repoRes.ok) return null;
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

  // Fetch up to 15 interesting source files
  const toFetch = sourcePaths.slice(0, 15);
  const keyFiles: RepoFile[] = [];
  await Promise.all(
    toFetch.map(async (path) => {
      const res = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.content) return;
      const content = Buffer.from(data.content, 'base64').toString('utf-8').slice(0, 2000);
      keyFiles.push({ path, content });
    })
  );

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
