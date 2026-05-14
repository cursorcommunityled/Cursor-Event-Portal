import Anthropic from '@anthropic-ai/sdk';
import type { Pass1Result, Pass2Result, Pass3Result } from '../types';

const CLICHE_PATTERNS = [
  'LangChain + Pinecone vector search CRUD',
  'Standard REST API CRUD app',
  'Todo / task manager',
  'Weather or News API wrapper',
  'Basic chatbot with OpenAI/Claude',
  'Portfolio or resume website',
  'Recipe finder',
  'Stock price tracker',
  'Twitter/social media clone',
  'Quiz or trivia app',
  'E-commerce with Stripe checkout',
  'Form with AI summarization',
  'Chatbot wrapper around a single API',
];

export async function runPass3(
  client: Anthropic,
  pass1: Pass1Result,
  pass2: Pass2Result
): Promise<Pass3Result> {
  const prompt = `You are a veteran hackathon judge known for cutting through the noise. Your job is to score INNOVATION only.

Scoring anchors (use the FULL range):
9-10: Genuinely rare combination. A senior engineer would say "I've never seen that before."
7-8: Solid creative angle, non-obvious tech combo, real domain insight
5-6: Familiar problem with some differentiation, or clean execution of a common pattern
3-4: Standard API integration with minimal twist
1-2: Direct clone or near-zero original concept

COMMON HACKATHON CLICHÉS to check against:
${CLICHE_PATTERNS.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Project summary: ${pass1.readme_summary}
Tech stack: ${pass1.tech_stack.join(', ')}
Template: ${pass1.template_detected ?? 'none (custom)'}
Clever solutions found: ${pass2.clever_solutions.join('; ') || 'none noted'}
Novel integrations: ${pass2.novel_api_integrations.join('; ') || 'none noted'}
Creative moments: ${pass2.creative_moments.join('; ') || 'none noted'}

Return ONLY valid JSON:
{
  "innovation_score": number (0-10, use the FULL range, calibrated to anchors above),
  "senior_engineer_surprise_factor": "meh" | "interesting" | "impressive" | "exceptional",
  "common_pattern_matches": ["which clichés from the list does this match?"],
  "differentiating_factors": ["what genuinely sets it apart from those patterns?"],
  "problem_novelty_notes": "1-2 sentences: is the problem space itself novel, or just the implementation?"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pass 3 returned no JSON');
  return JSON.parse(jsonMatch[0]) as Pass3Result;
}
