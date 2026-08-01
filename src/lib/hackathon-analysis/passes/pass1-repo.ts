import Anthropic from '@anthropic-ai/sdk';
import { withAnthropicRetry } from '../anthropic-retry';
import type { RepoData, Pass1Result } from '../types';
import { extractResponseText, parseJsonObject } from './json';

export async function runPass1(client: Anthropic, repoData: RepoData): Promise<Pass1Result> {
  const fileTreeSample = repoData.file_tree.slice(0, 80).join('\n');
  const langSummary = Object.entries(repoData.languages)
    .sort(([, a], [, b]) => b - a)
    .map(([lang, bytes]) => `${lang}: ${Math.round(bytes / 1000)}KB`)
    .join(', ');

  const prompt = `You are a senior engineer analyzing a hackathon GitHub repository. Extract structured metadata. Be factual, not evaluative.

Repository: ${repoData.owner}/${repoData.repo}
Fork: ${repoData.is_forked}
Files: ${repoData.file_count}
Languages: ${langSummary}
Commits in hackathon window: ${repoData.commit_count_in_window}
Authors: ${repoData.commit_authors.join(', ') || 'none'}
Template detected: ${repoData.template_detected ?? 'none'}
Original code ratio: ${(repoData.original_code_ratio * 100).toFixed(0)}%

File tree (sample):
${fileTreeSample}

README (first 2000 chars):
${repoData.readme.slice(0, 2000)}

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "github_url": "https://github.com/${repoData.owner}/${repoData.repo}",
  "is_forked": boolean,
  "file_count": number,
  "languages": { "Language": bytes },
  "tech_stack": ["string"],
  "template_detected": string | null,
  "template_confidence": number (0-1),
  "original_code_ratio": number (0-1),
  "commit_count_in_window": number,
  "commit_authors": ["string"],
  "readme_summary": "2-3 sentence summary of what the project is",
  "key_files": ["up to 10 important source file paths"]
}`;

  const response = await withAnthropicRetry(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    { label: 'pass1' }
  );

  return parseJsonObject<Pass1Result>(extractResponseText(response), 'Pass 1');
}
