import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureGithubAccess, fetchRepoData } from './github/repo-fetcher';
import { saveRepoCache } from './jobs';
import { runPass1 } from './passes/pass1-repo';
import { runPass2 } from './passes/pass2-code';
import { runPass3 } from './passes/pass3-innovation';
import { runPass4 } from './passes/pass4-visual';
import { runPass5 } from './passes/pass5-pool';
import { runPass6WithModel } from './passes/pass6-synthesis';
import type {
  AiJobDiagnostics,
  PassName,
  Pass1Result,
  Pass2Result,
  Pass3Result,
  Pass4Result,
  Pass5Result,
  PoolEntry,
  ProjectContext,
  RepoData,
} from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PASSES: PassName[] = [
  'pass1_repo',
  'pass2_code',
  'pass3_innovation',
  'pass4_visual',
  'pass5_pool',
  'pass6_synthesis',
];

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

async function savePass(
  supabase: ServiceClient,
  teamId: string,
  eventId: string,
  passName: PassName,
  status: 'pending' | 'running' | 'complete' | 'error' | 'cancelled',
  result?: unknown,
  error?: string,
  modelUsed?: string
) {
  await supabase.from('hackathon_ai_analyses').upsert(
    {
      team_id: teamId,
      event_id: eventId,
      pass_name: passName,
      status,
      result: result ?? null,
      error: error ?? null,
      model_used: modelUsed ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'team_id,pass_name' }
  );
}

async function cancelRemainingPasses(
  supabase: ServiceClient,
  teamId: string,
  eventId: string,
  fromPass: PassName,
  reason: string
) {
  const startIdx = PASSES.indexOf(fromPass);
  for (const p of PASSES.slice(startIdx + 1)) {
    await savePass(supabase, teamId, eventId, p, 'cancelled', undefined, reason);
  }
}

export type PipelineHooks = {
  onPassChange?: (pass: PassName) => Promise<void> | void;
};

export async function runAnalysisPipeline(
  ctx: ProjectContext,
  hooks?: PipelineHooks
): Promise<void> {
  const supabase = await createServiceClient();

  const { data: existingRows } = await supabase
    .from('hackathon_ai_analyses')
    .select('pass_name, status, result')
    .eq('team_id', ctx.teamId)
    .eq('event_id', ctx.eventId);

  const completed = new Map<string, unknown>();
  for (const row of existingRows ?? []) {
    if (row.status === 'complete' && row.result) {
      completed.set(row.pass_name, row.result);
    }
  }

  // Ensure pass rows exist; do not clobber completed ones.
  for (const p of PASSES) {
    if (completed.has(p)) continue;
    await savePass(supabase, ctx.teamId, ctx.eventId, p, 'pending');
  }

  let activePass: PassName = 'pass1_repo';

  try {
    await ensureGithubAccess();

    // ── Repo data (cached on job for resume) ──────────────────────────────────
    let repoData: RepoData | null = null;
    if (ctx.jobId) {
      const { data: job } = await supabase
        .from('hackathon_ai_jobs')
        .select('diagnostics')
        .eq('id', ctx.jobId)
        .maybeSingle();
      const diag = (job?.diagnostics ?? {}) as AiJobDiagnostics;
      if (diag.repo_cache?.owner && diag.repo_cache?.key_files) {
        repoData = diag.repo_cache;
      }
    }

    if (!repoData) {
      repoData = await fetchRepoData(ctx.repoUrl);
      if (!repoData) {
        throw new Error('Could not fetch GitHub repository. Ensure the URL is public and correct.');
      }
      if (ctx.jobId) {
        await saveRepoCache(ctx.jobId, repoData, ctx.repoUrl);
      }
    }

    // ── Pass 1 ────────────────────────────────────────────────────────────────
    activePass = 'pass1_repo';
    let pass1 = completed.get('pass1_repo') as Pass1Result | undefined;
    if (!pass1) {
      await hooks?.onPassChange?.(activePass);
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      try {
        pass1 = await runPass1(anthropic, repoData);
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass1_repo',
          'complete',
          pass1,
          undefined,
          'claude-sonnet-4-6'
        );
        completed.set('pass1_repo', pass1);
      } catch (e) {
        await savePass(supabase, ctx.teamId, ctx.eventId, 'pass1_repo', 'error', undefined, String(e));
        await cancelRemainingPasses(supabase, ctx.teamId, ctx.eventId, 'pass1_repo', String(e));
        throw e;
      }
    }

    // ── Pass 2 ────────────────────────────────────────────────────────────────
    activePass = 'pass2_code';
    let pass2 = completed.get('pass2_code') as Pass2Result | undefined;
    if (!pass2) {
      await hooks?.onPassChange?.(activePass);
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      try {
        pass2 = await runPass2(anthropic, repoData, pass1);
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass2_code',
          'complete',
          pass2,
          undefined,
          'claude-sonnet-4-6'
        );
        completed.set('pass2_code', pass2);
      } catch (e) {
        await savePass(supabase, ctx.teamId, ctx.eventId, 'pass2_code', 'error', undefined, String(e));
        await cancelRemainingPasses(supabase, ctx.teamId, ctx.eventId, 'pass2_code', String(e));
        throw e;
      }
    }

    // ── Pass 3 ────────────────────────────────────────────────────────────────
    activePass = 'pass3_innovation';
    let pass3 = completed.get('pass3_innovation') as Pass3Result | undefined;
    if (!pass3) {
      await hooks?.onPassChange?.(activePass);
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      try {
        pass3 = await runPass3(anthropic, pass1, pass2);
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass3_innovation',
          'complete',
          pass3,
          undefined,
          'claude-sonnet-4-6'
        );
        completed.set('pass3_innovation', pass3);
      } catch (e) {
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass3_innovation',
          'error',
          undefined,
          String(e)
        );
        await cancelRemainingPasses(supabase, ctx.teamId, ctx.eventId, 'pass3_innovation', String(e));
        throw e;
      }
    }

    // ── Pass 4 ────────────────────────────────────────────────────────────────
    activePass = 'pass4_visual';
    let pass4 = completed.get('pass4_visual') as Pass4Result | undefined;
    if (!pass4) {
      await hooks?.onPassChange?.(activePass);
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      try {
        pass4 = await runPass4(anthropic, ctx.screenshotUrls, {
          teamName: ctx.teamName,
          repoUrl: ctx.repoUrl,
          pitchText: ctx.pitchText,
          repoSummary: pass1.readme_summary,
        });
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass4_visual',
          'complete',
          pass4,
          undefined,
          'claude-sonnet-4-6'
        );
        completed.set('pass4_visual', pass4);
        if (ctx.jobId) {
          await saveRepoCache(ctx.jobId, repoData, ctx.repoUrl);
        }
      } catch (e) {
        await savePass(supabase, ctx.teamId, ctx.eventId, 'pass4_visual', 'error', undefined, String(e));
        await cancelRemainingPasses(supabase, ctx.teamId, ctx.eventId, 'pass4_visual', String(e));
        throw e;
      }
    }

    // ── Pass 5 ────────────────────────────────────────────────────────────────
    activePass = 'pass5_pool';
    let pass5 = completed.get('pass5_pool') as Pass5Result | undefined;
    if (!pass5) {
      await hooks?.onPassChange?.(activePass);
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');

      const { data: otherAnalyses } = await supabase
        .from('hackathon_ai_analyses')
        .select('team_id, pass_name, result')
        .eq('event_id', ctx.eventId)
        .eq('status', 'complete')
        .in('pass_name', ['pass1_repo', 'pass2_code', 'pass3_innovation'])
        .neq('team_id', ctx.teamId);

      const byTeam = new Map<string, Record<string, unknown>>();
      for (const row of otherAnalyses ?? []) {
        if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, {});
        byTeam.get(row.team_id)![row.pass_name] = row.result;
      }

      const otherTeamIds = [...byTeam.keys()];
      const pool: PoolEntry[] = [];

      if (otherTeamIds.length > 0) {
        const { data: teamRows } = await supabase
          .from('hackathon_teams')
          .select('id, name')
          .in('id', otherTeamIds);

        for (const t of teamRows ?? []) {
          const data = byTeam.get(t.id);
          if (data?.pass1_repo && data?.pass2_code && data?.pass3_innovation) {
            pool.push({
              teamName: t.name,
              pass1: data.pass1_repo as Pass1Result,
              pass2: data.pass2_code as Pass2Result,
              pass3: data.pass3_innovation as Pass3Result,
            });
          }
        }
      }

      try {
        pass5 = await runPass5(anthropic, { teamName: ctx.teamName, pass1, pass2, pass3 }, pool);
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass5_pool',
          'complete',
          pass5,
          undefined,
          'claude-sonnet-4-6'
        );
        completed.set('pass5_pool', pass5);
      } catch (e) {
        await savePass(supabase, ctx.teamId, ctx.eventId, 'pass5_pool', 'error', undefined, String(e));
        await cancelRemainingPasses(supabase, ctx.teamId, ctx.eventId, 'pass5_pool', String(e));
        throw e;
      }
    }

    // ── Pass 6 ────────────────────────────────────────────────────────────────
    activePass = 'pass6_synthesis';
    if (!completed.has('pass6_synthesis')) {
      await hooks?.onPassChange?.(activePass);
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      try {
        const { result: pass6, modelUsed } = await runPass6WithModel(
          anthropic,
          ctx.teamName,
          ctx.eventPrompt,
          ctx.pitchText,
          pass1,
          pass2,
          pass3,
          pass4,
          pass5
        );
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass6_synthesis',
          'complete',
          pass6,
          undefined,
          modelUsed
        );
      } catch (e) {
        await savePass(
          supabase,
          ctx.teamId,
          ctx.eventId,
          'pass6_synthesis',
          'error',
          undefined,
          String(e)
        );
        throw e;
      }
    }
  } catch (e) {
    await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'error', undefined, String(e));
    await cancelRemainingPasses(supabase, ctx.teamId, ctx.eventId, activePass, String(e));
    console.error(`[pipeline] Analysis failed for team ${ctx.teamId}:`, e);
  }
}
