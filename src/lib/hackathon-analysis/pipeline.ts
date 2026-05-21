import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchRepoData } from './github/repo-fetcher';
import { runPass1 } from './passes/pass1-repo';
import { runPass2 } from './passes/pass2-code';
import { runPass3 } from './passes/pass3-innovation';
import { runPass4 } from './passes/pass4-visual';
import { runPass5 } from './passes/pass5-pool';
import { runPass6WithModel } from './passes/pass6-synthesis';
import type { PassName, Pass1Result, Pass2Result, Pass3Result, PoolEntry, ProjectContext } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function savePass(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  teamId: string,
  eventId: string,
  passName: PassName,
  status: 'pending' | 'running' | 'complete' | 'error',
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

export async function runAnalysisPipeline(ctx: ProjectContext): Promise<void> {
  const supabase = await createServiceClient();

  const passes: PassName[] = ['pass1_repo', 'pass2_code', 'pass3_innovation', 'pass4_visual', 'pass5_pool', 'pass6_synthesis'];
  let activePass: PassName = 'pass1_repo';

  // Show the whole pipeline immediately, but only spin the pass that is actually running.
  for (const p of passes) {
    await savePass(supabase, ctx.teamId, ctx.eventId, p, p === activePass ? 'running' : 'pending');
  }

  try {
    // ── Pass 1: Repo archaeology ──────────────────────────────────────────────
    const repoData = await fetchRepoData(ctx.repoUrl);
    if (!repoData) throw new Error('Could not fetch GitHub repository. Ensure the URL is public and correct.');

    let pass1: Pass1Result;
    try {
      pass1 = await runPass1(anthropic, repoData);
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass1_repo', 'complete', pass1, undefined, 'claude-sonnet-4-6');
    } catch (e) {
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass1_repo', 'error', undefined, String(e));
      throw e;
    }

    // ── Pass 2: Code deep-dive ────────────────────────────────────────────────
    activePass = 'pass2_code';
    await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
    let pass2: Pass2Result;
    try {
      pass2 = await runPass2(anthropic, repoData, pass1);
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass2_code', 'complete', pass2, undefined, 'claude-sonnet-4-6');
    } catch (e) {
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass2_code', 'error', undefined, String(e));
      throw e;
    }

    // ── Pass 3: Innovation audit ──────────────────────────────────────────────
    activePass = 'pass3_innovation';
    await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
    let pass3: Pass3Result;
    try {
      pass3 = await runPass3(anthropic, pass1, pass2);
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass3_innovation', 'complete', pass3, undefined, 'claude-sonnet-4-6');
    } catch (e) {
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass3_innovation', 'error', undefined, String(e));
      throw e;
    }

    // ── Pass 4: Visual/UX ─────────────────────────────────────────────────────
    activePass = 'pass4_visual';
    await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
    try {
      const pass4 = await runPass4(anthropic, ctx.screenshotUrls, {
        teamName: ctx.teamName,
        repoUrl: ctx.repoUrl,
        pitchText: ctx.pitchText,
        repoSummary: pass1.readme_summary,
      });
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass4_visual', 'complete', pass4, undefined, 'claude-sonnet-4-6');
    } catch (e) {
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass4_visual', 'error', undefined, String(e));
      throw e;
    }

    // ── Pass 5: Pool comparison ───────────────────────────────────────────────
    // Fetch other teams' completed pass1/2/3 analyses from DB
    const { data: otherAnalyses } = await supabase
      .from('hackathon_ai_analyses')
      .select('team_id, pass_name, result')
      .eq('event_id', ctx.eventId)
      .eq('status', 'complete')
      .in('pass_name', ['pass1_repo', 'pass2_code', 'pass3_innovation'])
      .neq('team_id', ctx.teamId);

    // Group by team_id
    const byTeam = new Map<string, Record<string, unknown>>();
    for (const row of otherAnalyses ?? []) {
      if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, {});
      byTeam.get(row.team_id)![row.pass_name] = row.result;
    }

    // Fetch team names
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
      activePass = 'pass5_pool';
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      const pass5 = await runPass5(anthropic, { teamName: ctx.teamName, pass1, pass2, pass3 }, pool);
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass5_pool', 'complete', pass5, undefined, 'claude-sonnet-4-6');
    } catch (e) {
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass5_pool', 'error', undefined, String(e));
      throw e;
    }

    // ── Pass 6: Synthesis ─────────────────────────────────────────────────────
    // Re-read passes from DB to get typed results
    const { data: allPasses } = await supabase
      .from('hackathon_ai_analyses')
      .select('pass_name, result')
      .eq('team_id', ctx.teamId)
      .eq('status', 'complete');

    const passMap = new Map((allPasses ?? []).map((p) => [p.pass_name, p.result]));

    try {
      activePass = 'pass6_synthesis';
      await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'running');
      const p1 = passMap.get('pass1_repo') as Pass1Result;
      const p2 = passMap.get('pass2_code') as Pass2Result;
      const p3 = passMap.get('pass3_innovation') as Pass3Result;
      const p4 = passMap.get('pass4_visual');
      const p5 = passMap.get('pass5_pool');

      const { result: pass6, modelUsed } = await runPass6WithModel(
        anthropic,
        ctx.teamName,
        ctx.pitchText,
        p1, p2, p3,
        p4 as Awaited<ReturnType<typeof runPass4>>,
        p5 as Awaited<ReturnType<typeof runPass5>>
      );
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass6_synthesis', 'complete', pass6, undefined, modelUsed);
    } catch (e) {
      await savePass(supabase, ctx.teamId, ctx.eventId, 'pass6_synthesis', 'error', undefined, String(e));
      throw e;
    }

  } catch (e) {
    await savePass(supabase, ctx.teamId, ctx.eventId, activePass, 'error', undefined, String(e));
    console.error(`[pipeline] Analysis failed for team ${ctx.teamId}:`, e);
  }
}
