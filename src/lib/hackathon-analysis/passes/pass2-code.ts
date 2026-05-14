import Anthropic from '@anthropic-ai/sdk';
import type { RepoData, Pass1Result, Pass2Result } from '../types';

export async function runPass2(
  client: Anthropic,
  repoData: RepoData,
  pass1: Pass1Result
): Promise<Pass2Result> {
  const filesContent = repoData.key_files
    .map((f) => `=== ${f.path} ===\n${f.content}`)
    .join('\n\n');

  const prompt = `You are a senior engineer reviewing hackathon code. This was built in ~24 hours.

CRITICAL CONTEXT — DO NOT penalize:
- Messy code, lack of refactoring, no tests
- TODO comments, incomplete features, simple architecture
- Missing error handling or non-idiomatic patterns
- Copy-pasted boilerplate from templates

WHAT TO LOOK FOR:
- Genuine moments of technical creativity
- Surprising API integrations or unexpected library use
- Evidence of solving genuinely hard problems (async, real-time, ML, graph algorithms)
- Architectural decisions showing thoughtfulness beyond the obvious

Project: ${pass1.readme_summary}
Tech stack: ${pass1.tech_stack.join(', ')}
Template: ${pass1.template_detected ?? 'none'}
Authors: ${pass1.commit_authors.join(', ')}

Source files:
${filesContent}

Return ONLY valid JSON:
{
  "architecture_notes": "1-2 sentences on overall structure",
  "clever_solutions": ["specific code moments that show creativity — quote file/function names"],
  "novel_api_integrations": ["any non-obvious external service or API usage"],
  "creative_moments": ["surprising or impressive things found in the code"],
  "code_quality_notes": "honest 1-2 sentence assessment (remember: 24 hour hackathon)",
  "files_analyzed": ["list of files actually reviewed"],
  "technical_score_raw": number (0-10, weight toward creativity not cleanliness),
  "functional_score_raw": number (0-10, does the core loop appear to work?)
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pass 2 returned no JSON');
  return JSON.parse(jsonMatch[0]) as Pass2Result;
}
