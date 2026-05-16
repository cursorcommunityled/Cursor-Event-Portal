import Anthropic from '@anthropic-ai/sdk';
import type { Pass1Result, Pass2Result, Pass3Result, Pass4Result, Pass5Result, Pass6Result } from '../types';
import { DEFAULT_CRITERIA } from '../criteria';

export type Pass6RunResult = {
  result: Pass6Result;
  modelUsed: string;
};

function parsePass6Json(text: string): Pass6Result {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pass 6 returned no JSON');
  return JSON.parse(jsonMatch[0]) as Pass6Result;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runPass6(
  client: Anthropic,
  teamName: string,
  pitchText: string | null,
  pass1: Pass1Result,
  pass2: Pass2Result,
  pass3: Pass3Result,
  pass4: Pass4Result,
  pass5: Pass5Result
): Promise<Pass6Result> {
  const { result } = await runPass6WithModel(client, teamName, pitchText, pass1, pass2, pass3, pass4, pass5);
  return result;
}

export async function runPass6WithModel(
  client: Anthropic,
  teamName: string,
  pitchText: string | null,
  pass1: Pass1Result,
  pass2: Pass2Result,
  pass3: Pass3Result,
  pass4: Pass4Result,
  pass5: Pass5Result
): Promise<Pass6RunResult> {
  const criteriaBlock = DEFAULT_CRITERIA.map((c) =>
    `${c.key} (weight ${(c.weight * 100).toFixed(0)}%): ${c.label} — ${c.description}`
  ).join('\n');

  const prompt = `You are the final judge synthesizing a complete AI analysis of a hackathon project. Use the full 0-10 range — score compression (everything landing 6-8) is a failure.

CALIBRATION RULES:
- Missing/zero elements (no UI, no commits, backend-only) pull into 1-4 range
- Straightforward 2-API integration = 4-5 on innovation, NOT 6-7
- Exceptional domain insight or rare engineering = 8-9
- If two projects would score the same overall, ask: is one genuinely 2x better?

EVIDENCE:
Team: ${teamName}
Pitch: ${pitchText ?? '(none provided)'}

Pass 1 (Repo):
- Stack: ${pass1.tech_stack.join(', ')}
- Template: ${pass1.template_detected ?? 'none'}
- Commits in window: ${pass1.commit_count_in_window}
- Summary: ${pass1.readme_summary}

Pass 2 (Code):
- Technical score: ${pass2.technical_score_raw}/10
- Functional score: ${pass2.functional_score_raw}/10
- Clever solutions: ${pass2.clever_solutions.join('; ') || 'none'}
- Novel integrations: ${pass2.novel_api_integrations.join('; ') || 'none'}
- Architecture: ${pass2.architecture_notes}

Pass 3 (Innovation):
- Innovation score: ${pass3.innovation_score}/10
- Surprise factor: ${pass3.senior_engineer_surprise_factor}
- Common clichés matched: ${pass3.common_pattern_matches.join(', ') || 'none'}
- Differentiators: ${pass3.differentiating_factors.join('; ') || 'none'}
- Novelty: ${pass3.problem_novelty_notes}

Pass 4 (Visual):
- Screenshots analyzed: ${pass4.screenshots_analyzed}
- Visual hierarchy: ${pass4.visual_hierarchy_score}/10
- Design consistency: ${pass4.design_consistency_score}/10
- UX flow: ${pass4.ux_flow_score}/10
- Overall visual: ${pass4.overall_visual_score}/10
- Commentary: ${pass4.ux_commentary.join(' | ')}

Pass 5 (Pool):
- Pool rank: ${pass5.pool_rank}/${pass5.pool_size}
- Percentile: ${pass5.percentile}
- Outperforms on: ${pass5.outperforms_pool_on.join(', ') || 'nothing notable'}
- Underperforms on: ${pass5.underperforms_pool_on.join(', ') || 'nothing notable'}

SCORING CRITERIA (7 dimensions):
${criteriaBlock}

For each criterion, provide:
- score: 0-10 (use full range, calibrated to the anchors above)
- reasoning: 3-5 sentences citing specific evidence from the passes above
- confidence: "low" | "medium" | "high"

The overall_score is the weighted sum of criteria scores × weights.

Return ONLY valid JSON:
{
  "criteria_scores": [
    {
      "criteria_key": "innovation",
      "score": number,
      "reasoning": "string",
      "confidence": "low" | "medium" | "high"
    }
    // ... all 7 criteria
  ],
  "overall_score": number (weighted composite, 0-10),
  "most_impressive_aspect": "1-2 sentences on the single strongest thing",
  "concerns_and_limitations": ["2-4 honest, specific concerns"],
  "judge_briefing_points": ["3-5 bullet points for human judges reviewing this project"],
  "recommended_award_categories": ["e.g. Best Use of AI, Most Creative, Best Technical, Most Useful"]
}`;

  const attempts = [
    {
      model: 'claude-opus-4-7',
      max_tokens: 8192,
    },
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
    },
  ] as const;

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      const response = await client.messages.create({
        ...attempt,
        messages: [{ role: 'user', content: prompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as Awaited<ReturnType<typeof client.messages.create>>;

      // Thinking blocks are separate from the final text response.
      const content = (response as { content: { type: string; text?: string }[] }).content;
      const textBlock = content.find((b) => b.type === 'text');
      const result = parsePass6Json(textBlock?.text ?? '');
      return { result, modelUsed: attempt.model };
    } catch (error) {
      failures.push(`${attempt.model}: ${errorMessage(error)}`);
    }
  }

  throw new Error(`Pass 6 failed. ${failures.join(' | ')}`);
}
