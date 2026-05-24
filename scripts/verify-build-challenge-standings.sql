-- Read-only post-change verification for the SAIT Build Challenge judging state.
-- This compares live scorecard totals against the snapshot captured on 2026-05-23.

with params as (
  select
    'calgary-hackathon-sait-may-2026'::text as event_slug,
    'Cursor Calgary Hackathon - SAIT Build Challenge'::text as competition_title
),
expected as (
  select *
  from (values
    ('SimRanch'::text, 2::bigint, 146::numeric),
    ('Codebase Security Auditor', 2, 192),
    ('Hackathon Judge', 2, 120),
    ('Chinook Weekly', 2, 128),
    ('Image Background Remover', 2, 98),
    ('RZ Trial Seed Tracker', 2, 124),
    ('Bulk QR Generator', 2, 169),
    ('BMF Packhouse', 2, 104)
  ) as rows(entry_title, expected_judge_count, expected_total_saved_points)
),
target_competition as (
  select c.id as competition_id
  from events e
  join competitions c on c.event_id = e.id
  join params p on p.event_slug = e.slug and p.competition_title = c.title
  limit 1
),
actual as (
  select
    ce.title as entry_title,
    count(distinct cjsc.judge_id) as judge_count,
    coalesce(sum(cjsi.points), 0) as total_saved_points,
    coalesce(round(sum(cjsi.points)::numeric / nullif(count(distinct cjsc.judge_id), 0), 2), 0) as final_score
  from competition_finalist_entries cfe
  join target_competition tc on tc.competition_id = cfe.competition_id
  join competition_entries ce on ce.id = cfe.entry_id
  left join competition_judging_scorecards cjsc
    on cjsc.competition_id = cfe.competition_id
   and cjsc.entry_id = cfe.entry_id
  left join competition_judging_score_items cjsi on cjsi.scorecard_id = cjsc.id
  group by ce.title
)
select
  coalesce(a.entry_title, e.entry_title) as entry_title,
  e.expected_judge_count,
  a.judge_count as actual_judge_count,
  e.expected_total_saved_points,
  a.total_saved_points as actual_total_saved_points,
  a.final_score,
  case
    when a.entry_title is null then 'missing_live_entry'
    when e.entry_title is null then 'unexpected_live_entry'
    when a.judge_count <> e.expected_judge_count then 'judge_count_changed'
    when a.total_saved_points <> e.expected_total_saved_points then 'points_changed'
    else 'ok'
  end as verification_status
from expected e
full outer join actual a on a.entry_title = e.entry_title
order by verification_status desc, a.final_score desc nulls last, entry_title;
