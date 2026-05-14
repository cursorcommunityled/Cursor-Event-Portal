import Anthropic from '@anthropic-ai/sdk';
import type { Pass4Result } from '../types';

async function urlToBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const mediaType = (
      contentType.includes('png') ? 'image/png' :
      contentType.includes('gif') ? 'image/gif' :
      contentType.includes('webp') ? 'image/webp' :
      'image/jpeg'
    ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');
    return { data, mediaType };
  } catch {
    return null;
  }
}

export async function runPass4(
  client: Anthropic,
  screenshotUrls: string[]
): Promise<Pass4Result> {
  if (!screenshotUrls.length) {
    return {
      visual_hierarchy_score: 0,
      design_consistency_score: 0,
      ux_flow_score: 0,
      brand_cohesion_score: 0,
      overall_visual_score: 0,
      screenshots_analyzed: 0,
      ux_commentary: ['No screenshots provided — visual analysis skipped.'],
    };
  }

  // Fetch up to 5 screenshots as base64
  const images = (
    await Promise.all(screenshotUrls.slice(0, 5).map(urlToBase64))
  ).filter((img): img is NonNullable<typeof img> => img !== null);

  if (!images.length) {
    return {
      visual_hierarchy_score: 0,
      design_consistency_score: 0,
      ux_flow_score: 0,
      brand_cohesion_score: 0,
      overall_visual_score: 0,
      screenshots_analyzed: 0,
      ux_commentary: ['Screenshots could not be loaded.'],
    };
  }

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `You are a UX designer judging hackathon projects. Analyze the ${images.length} screenshot(s) above.

PHILOSOPHY: Clean, minimal, working UI scores higher than ambitious but broken UI. A well-structured landing page with clear purpose beats a cluttered dashboard. Consider that this was built in 24 hours.

Evaluate each dimension 0-10:
- visual_hierarchy_score: Can you tell what's important? Is there a clear primary action?
- design_consistency_score: Are colors, typography, and spacing intentional and consistent?
- ux_flow_score: Is it obvious how to use it? Would a stranger understand without guidance?
- brand_cohesion_score: Is there a distinct visual identity beyond generic defaults?

Return ONLY valid JSON:
{
  "visual_hierarchy_score": number,
  "design_consistency_score": number,
  "ux_flow_score": number,
  "brand_cohesion_score": number,
  "overall_visual_score": number (weighted average),
  "screenshots_analyzed": ${images.length},
  "ux_commentary": ["2-4 specific, constructive observations about what you see"]
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pass 4 returned no JSON');
  return JSON.parse(jsonMatch[0]) as Pass4Result;
}
