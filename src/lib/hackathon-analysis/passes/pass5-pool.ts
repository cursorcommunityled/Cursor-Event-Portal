import Anthropic from '@anthropic-ai/sdk';
import { withAnthropicRetry } from '../anthropic-retry';
import type { Pass1Result, Pass2Result, Pass3Result, Pass5Result, PoolEntry } from '../types';
import { extractResponseText, parseJsonObject } from './json';

export async function runPass5(
  client: Anthropic,
  current: { teamName: string; pass1: Pass1Result; pass2: Pass2Result; pass3: Pass3Result },
  pool: PoolEntry[]
): Promise<Pass5Result> {
  const poolSize = pool.length + 1; // include current

  if (pool.length < 3) {
    // Not enough pool data — return centered estimate
    return {
      pool_rank: Math.ceil(poolSize / 2),
      pool_size: poolSize,
      percentile: 50,
      relative_standing: 'Pool comparison requires at least 4 analyzed projects. Score is a centered estimate.',
      outperforms_pool_on: [],
      underperforms_pool_on: [],
      comparable_submissions: [],
    };
  }

  const poolSummaries = pool.map((p, i) => {
    return `Team ${i + 1}: ${p.teamName}
  Stack: ${p.pass1.tech_stack.join(', ')}
  Innovation: ${p.pass3.innovation_score}/10 (${p.pass3.senior_engineer_surprise_factor})
  Technical: ${p.pass2.technical_score_raw}/10
  Functional: ${p.pass2.functional_score_raw}/10
  Template: ${p.pass1.template_detected ?? 'custom'}
  Summary: ${p.pass1.readme_summary}`;
  }).join('\n\n');

  const currentSummary = `Current team: ${current.teamName}
  Stack: ${current.pass1.tech_stack.join(', ')}
  Innovation: ${current.pass3.innovation_score}/10 (${current.pass3.senior_engineer_surprise_factor})
  Technical: ${current.pass2.technical_score_raw}/10
  Functional: ${current.pass2.functional_score_raw}/10
  Template: ${current.pass1.template_detected ?? 'custom'}
  Summary: ${current.pass1.readme_summary}
  Differentiators: ${current.pass3.differentiating_factors.join('; ')}`;

  const prompt = `You are comparing hackathon submissions. Rank the current project within its pool.

CURRENT PROJECT:
${currentSummary}

POOL (${pool.length} other projects):
${poolSummaries}

Return ONLY valid JSON:
{
  "pool_rank": number (1 = best in pool of ${poolSize}),
  "pool_size": ${poolSize},
  "percentile": number (0-100, higher = better),
  "relative_standing": "1-2 sentences comparing this project to the pool",
  "outperforms_pool_on": ["dimensions where this clearly beats most others"],
  "underperforms_pool_on": ["dimensions where this clearly lags most others"],
  "comparable_submissions": ["team names of similar quality projects"]
}`;

  const response = await withAnthropicRetry(
    () =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    { label: 'pass5' }
  );
  return parseJsonObject<Pass5Result>(extractResponseText(response), 'Pass 5');
}
