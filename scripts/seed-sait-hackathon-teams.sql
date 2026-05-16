-- ============================================================
-- Seed 9 test teams and projects for the SAIT Hackathon
-- Run this in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  -- 1. Get the event ID for SAIT May 2026
  SELECT id INTO v_event_id 
  FROM public.events 
  WHERE slug = 'calgary-hackathon-sait-may-2026';
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'SAIT event not found. Did you run the migration first?';
  END IF;

  CREATE TEMP TABLE tmp_sait_hackathon_seed_teams (
    team_id UUID NOT NULL DEFAULT gen_random_uuid(),
    leader_id UUID,
    leader_name TEXT NOT NULL,
    leader_email TEXT NOT NULL,
    team_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT NOT NULL,
    repo_url TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_sait_hackathon_seed_teams (leader_name, leader_email, team_name, project_name, description, repo_url)
  VALUES
    ('Chinook Weekly Lead', 'sait-team-01@example.com', 'Chinook Weekly', 'Chinook Weekly', 'Weekly call summary automation for Chinook Gardener.', 'https://github.com/neweraintelligence/Chinook-weekly'),
    ('Hackathon Judge Lead', 'sait-team-02@example.com', 'Hackathon Judge', 'Hackathon Judge', 'AI judging app for hackathon submissions.', 'https://github.com/neweraintelligence/Hackathon-Judge'),
    ('SimRanch Lead', 'sait-team-03@example.com', 'SimRanch', 'SimRanch', 'Game Boy style ranch simulation.', 'https://github.com/neweraintelligence/SimRanch'),
    ('RZ Trial Seed Tracker Lead', 'sait-team-04@example.com', 'RZ Trial Seed Tracker', 'RZ Trial Seed Tracker', 'Seed trial tracking application.', 'https://github.com/neweraintelligence/RZ-Trial-Seed-Tracker'),
    ('Garden Center Voice Landing Lead', 'sait-team-05@example.com', 'Garden Center Voice Landing', 'Garden Center Voice Landing', 'Landing page for a garden center AI voice receptionist.', 'https://github.com/neweraintelligence/Garden-Center-Voice-Landing'),
    ('Image Background Remover Lead', 'sait-team-06@example.com', 'Image Background Remover', 'Image Background Remover', 'Image background removal app.', 'https://github.com/neweraintelligence/Image-Background-Remover'),
    ('Bulk QR Generator Lead', 'sait-team-07@example.com', 'Bulk QR Generator', 'Bulk QR Generator', 'Bulk QR code generation tool.', 'https://github.com/neweraintelligence/Bulk-QR-Generator'),
    ('BMF Packhouse Lead', 'sait-team-08@example.com', 'BMF Packhouse', 'BMF Packhouse', 'Interactive digital twin for cucumber packhouse operations.', 'https://github.com/neweraintelligence/BMF-Packhouse'),
    ('Codebase Security Auditor Lead', 'sait-team-09@example.com', 'Codebase Security Auditor', 'Codebase Security Auditor', 'Security audit assistant for codebases.', 'https://github.com/neweraintelligence/Codebase-security-auditor');

  -- 2. Create one test user per team.
  INSERT INTO public.users (email, name, role)
  SELECT leader_email, leader_name, 'attendee'
  FROM tmp_sait_hackathon_seed_teams
  ON CONFLICT (email) DO UPDATE
  SET name = EXCLUDED.name;

  UPDATE tmp_sait_hackathon_seed_teams seed
  SET leader_id = u.id
  FROM public.users u
  WHERE u.email = seed.leader_email;

  -- Re-running this seed should replace only these test teams.
  DELETE FROM public.hackathon_teams ht
  USING tmp_sait_hackathon_seed_teams seed
  WHERE ht.event_id = v_event_id
    AND ht.name = seed.team_name;

  -- 3. Insert 9 teams.
  INSERT INTO public.hackathon_teams (id, event_id, name, created_by, locked_at)
  SELECT team_id, v_event_id, team_name, leader_id, NOW()
  FROM tmp_sait_hackathon_seed_teams;

  -- 4. Assign the user as leader of these teams.
  INSERT INTO public.hackathon_team_members (team_id, user_id, role)
  SELECT team_id, leader_id, 'leader'
  FROM tmp_sait_hackathon_seed_teams;

  -- 5. Create submitted projects for each team.
  INSERT INTO public.hackathon_projects (team_id, event_id, name, description, repo_url, submitted_at)
  SELECT team_id, v_event_id, project_name, description, repo_url, NOW()
  FROM tmp_sait_hackathon_seed_teams;

END $$;
