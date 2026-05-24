-- Read-only backup snapshot for the SAIT Build Challenge final-round judging state.
-- Run in Supabase SQL Editor before publishing or cleanup to capture finalists,
-- scorecards, score items, published results, and calculated standings.

with params as (
  select
    'calgary-hackathon-sait-may-2026'::text as event_slug,
    'Cursor Calgary Hackathon - SAIT Build Challenge'::text as competition_title
),
target_competition as (
  select
    e.id as event_id,
    e.slug as event_slug,
    e.name as event_name,
    c.id as competition_id,
    c.title as competition_title,
    c.status as competition_status,
    c.voting_mode
  from events e
  join competitions c on c.event_id = e.id
  join params p on p.event_slug = e.slug and p.competition_title = c.title
  limit 1
),
criteria as (
  select cjc.*
  from competition_judging_criteria cjc
  join target_competition tc on tc.competition_id = cjc.competition_id
),
finalists as (
  select
    cfe.*,
    ce.title as entry_title,
    ce.repo_url,
    ce.project_url,
    ce.user_id,
    u.name as submitter_name,
    u.email as submitter_email
  from competition_finalist_entries cfe
  join target_competition tc on tc.competition_id = cfe.competition_id
  join competition_entries ce on ce.id = cfe.entry_id
  left join users u on u.id = ce.user_id
),
scorecards as (
  select
    cjsc.*,
    u.name as judge_name,
    u.email as judge_email
  from competition_judging_scorecards cjsc
  join target_competition tc on tc.competition_id = cjsc.competition_id
  left join users u on u.id = cjsc.judge_id
),
score_items as (
  select
    cjsi.*,
    cjsc.entry_id,
    cjsc.judge_id,
    cjc.slug as criterion_slug,
    cjc.label as criterion_label,
    cjc.max_points
  from competition_judging_score_items cjsi
  join scorecards cjsc on cjsc.id = cjsi.scorecard_id
  join competition_judging_criteria cjc on cjc.id = cjsi.criterion_id
),
standings as (
  select
    f.entry_id,
    f.entry_title,
    f.position,
    count(distinct s.id) as judge_count,
    coalesce(round(sum(si.points)::numeric / nullif(count(distinct s.id), 0), 2), 0) as final_score,
    coalesce((select sum(max_points) from criteria where is_active), 100) as max_score
  from finalists f
  left join scorecards s on s.entry_id = f.entry_id
  left join score_items si on si.scorecard_id = s.id
  group by f.entry_id, f.entry_title, f.position
)
select jsonb_pretty(jsonb_build_object(
  'captured_at', now(),
  'competition', (select to_jsonb(tc) from target_competition tc),
  'criteria', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb) from criteria c),
  'finalists', (select coalesce(jsonb_agg(to_jsonb(f) order by f.position), '[]'::jsonb) from finalists f),
  'scorecards', (select coalesce(jsonb_agg(to_jsonb(s) order by s.entry_id, s.judge_name), '[]'::jsonb) from scorecards s),
  'score_items', (select coalesce(jsonb_agg(to_jsonb(si) order by si.entry_id, si.judge_id, si.criterion_slug), '[]'::jsonb) from score_items si),
  'published_results', (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.placement), '[]'::jsonb)
    from competition_judging_results r
    join target_competition tc on tc.competition_id = r.competition_id
  ),
  'standings', (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.final_score desc, s.judge_count desc), '[]'::jsonb)
    from standings s
  )
)) as judging_backup_snapshot;
