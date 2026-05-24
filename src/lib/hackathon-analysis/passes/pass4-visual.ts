import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import type { Pass4Result } from '../types';
import { extractResponseText, parseJsonObject } from './json';

interface Pass4Context {
  teamName?: string;
  repoUrl?: string;
  pitchText?: string | null;
  repoSummary?: string | null;
}

type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const ANTHROPIC_MAX_BASE64_IMAGE_BYTES = 5 * 1024 * 1024;
const ANTHROPIC_BASE64_SAFETY_MARGIN_BYTES = 128 * 1024;
const ANTHROPIC_SAFE_BASE64_IMAGE_BYTES = ANTHROPIC_MAX_BASE64_IMAGE_BYTES - ANTHROPIC_BASE64_SAFETY_MARGIN_BYTES;
const IMAGE_COMPRESSION_ATTEMPTS = [
  { maxDimension: 1600, quality: 78 },
  { maxDimension: 1200, quality: 72 },
  { maxDimension: 900, quality: 66 },
  { maxDimension: 700, quality: 60 },
  { maxDimension: 550, quality: 55 },
] as const;

function detectImageMediaType(buffer: Buffer, contentType: string | null): SupportedImageMediaType {
  if (buffer.length >= 12) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
      return 'image/gif';
    }
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
  }

  const normalizedContentType = contentType?.toLowerCase() ?? '';
  if (normalizedContentType.includes('png')) return 'image/png';
  if (normalizedContentType.includes('gif')) return 'image/gif';
  if (normalizedContentType.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

function estimatedBase64Bytes(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

function fitsAnthropicImageLimit(buffer: Buffer): boolean {
  return estimatedBase64Bytes(buffer.length) <= ANTHROPIC_SAFE_BASE64_IMAGE_BYTES;
}

async function prepareImageForAnthropic(
  buffer: Buffer,
  contentType: string | null
): Promise<{ buffer: Buffer; mediaType: SupportedImageMediaType } | null> {
  const mediaType = detectImageMediaType(buffer, contentType);
  if (fitsAnthropicImageLimit(buffer)) {
    return { buffer, mediaType };
  }

  for (const attempt of IMAGE_COMPRESSION_ATTEMPTS) {
    const compressed = await sharp(buffer, { animated: false })
      .rotate()
      .resize({
        width: attempt.maxDimension,
        height: attempt.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();

    if (fitsAnthropicImageLimit(compressed)) {
      return { buffer: compressed, mediaType: 'image/jpeg' };
    }
  }

  return null;
}

async function urlToBase64(url: string): Promise<{ data: string; mediaType: SupportedImageMediaType } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const image = await prepareImageForAnthropic(buffer, res.headers.get('content-type'));
    if (!image) return null;

    const data = image.buffer.toString('base64');
    if (Buffer.byteLength(data, 'utf8') > ANTHROPIC_MAX_BASE64_IMAGE_BYTES) return null;

    return { data, mediaType: image.mediaType };
  } catch {
    return null;
  }
}

export async function runPass4(
  client: Anthropic,
  screenshotUrls: string[],
  context: Pass4Context = {}
): Promise<Pass4Result> {
  if (!screenshotUrls.length) {
    return {
      visual_hierarchy_score: 0,
      design_consistency_score: 0,
      ux_flow_score: 0,
      brand_cohesion_score: 0,
      screenshot_relevance_score: 0,
      product_intent_alignment_score: 0,
      overall_visual_score: 0,
      screenshots_analyzed: 0,
      ux_commentary: ['No screenshots provided — visual analysis skipped.'],
      relevance_notes: ['No screenshots were provided to validate against the project.'],
      product_intent_notes: ['No UI evidence was available to evaluate against product intent.'],
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
      screenshot_relevance_score: 0,
      product_intent_alignment_score: 0,
      overall_visual_score: 0,
      screenshots_analyzed: 0,
      ux_commentary: ['Screenshots could not be loaded.'],
      relevance_notes: ['The screenshot URLs could not be fetched for visual analysis.'],
      product_intent_notes: ['No loaded UI evidence was available to evaluate against product intent.'],
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

PROJECT CONTEXT:
- Team/project name: ${context.teamName ?? 'unknown'}
- Repo URL: ${context.repoUrl ?? 'unknown'}
- Pitch/description: ${context.pitchText ?? 'none provided'}
- Repo summary: ${context.repoSummary ?? 'none available'}

PHILOSOPHY: Judge the UI relative to what this product is trying to accomplish. Clean, minimal, working UI scores higher than ambitious but broken UI. A well-structured interface that makes the product's intended job obvious beats a polished but irrelevant or generic screen. Consider that this was built in 24 hours.

Evaluate each dimension 0-10:
- visual_hierarchy_score: Does the hierarchy emphasize what matters for this product's purpose? For example, a security auditor should prioritize findings, severity, affected files, and next actions, not decorative chrome.
- design_consistency_score: Are colors, typography, spacing, and components intentional and consistent in service of the product's intended workflow?
- ux_flow_score: Is it obvious how the intended user would complete the product's core job from this UI?
- brand_cohesion_score: Is there a visual identity that fits the product's domain and audience rather than generic defaults?
- screenshot_relevance_score: Do the screenshots appear to be from this submitted project, based on the project context above? Penalize unrelated third-party product screenshots, stock/mockup images, or images that clearly do not represent the project.
- product_intent_alignment_score: How well does the UI support the product intention implied by the project name, pitch, repo, and repo summary? Penalize UI that may be attractive but mismatched to the problem, audience, or core workflow.

CALIBRATION RULES:
- If the screenshot is visually polished but clearly unrelated to the submitted project, cap overall_visual_score at 3.
- If the screenshot appears to be a copied third-party product/game/app screen rather than the team's own build, cap overall_visual_score at 3.
- If the screenshot belongs to the project but does not make the product's intended use clear, product_intent_alignment_score should be 4 or lower.
- If the UI is rough but strongly supports the product's intended job, it can still score reasonably on product_intent_alignment_score while losing points on polish dimensions.
- If the context is limited but the screenshot plausibly matches, score normally and mention low confidence in relevance_notes.

Return ONLY valid JSON:
{
  "visual_hierarchy_score": number,
  "design_consistency_score": number,
  "ux_flow_score": number,
  "brand_cohesion_score": number,
  "screenshot_relevance_score": number,
  "product_intent_alignment_score": number,
  "overall_visual_score": number (weighted average after relevance caps),
  "screenshots_analyzed": ${images.length},
  "ux_commentary": ["2-4 specific, constructive observations about what you see"],
  "relevance_notes": ["1-3 observations about whether the screenshots match the submitted project"],
  "product_intent_notes": ["1-3 observations about how well the UI supports the intended product and user workflow"]
}`,
          },
        ],
      },
    ],
  });

  return parseJsonObject<Pass4Result>(extractResponseText(response), 'Pass 4');
}
