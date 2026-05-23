-- Add targeted indexes for the high-concurrency event/hackathon paths.
-- These are safe to run repeatedly and skip optional tables that may not exist
-- in older local databases.

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_slug_lookup ON public.events (slug)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_admin_code_lookup ON public.events (admin_code)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_status_start_time_lookup ON public.events (status, start_time DESC)';
  END IF;

  IF to_regclass('public.registrations') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registrations_event_user_lookup ON public.registrations (event_id, user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registrations_user_event_lookup ON public.registrations (user_id, event_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registrations_event_checked_in_lookup ON public.registrations (event_id, checked_in_at) WHERE checked_in_at IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_registrations_event_created_lookup ON public.registrations (event_id, created_at)';
  END IF;

  IF to_regclass('public.table_registrations') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_table_registrations_event_user_cover ON public.table_registrations (event_id, user_id) INCLUDE (id, table_number)';
  END IF;

  IF to_regclass('public.suggested_group_members') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suggested_group_members_user_group_lookup ON public.suggested_group_members (user_id, group_id)';
  END IF;

  IF to_regclass('public.suggested_groups') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suggested_groups_assignment_lookup ON public.suggested_groups (event_id, status, table_number) INCLUDE (id, name) WHERE table_number IS NOT NULL';
  END IF;

  IF to_regclass('public.attendee_intakes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attendee_intakes_event_user_lookup ON public.attendee_intakes (event_id, user_id)';
  END IF;

  IF to_regclass('public.hackathon_teams') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_teams_event_created_lookup ON public.hackathon_teams (event_id, created_at)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_teams_event_category_lookup ON public.hackathon_teams (event_id, category)';
  END IF;

  IF to_regclass('public.hackathon_team_members') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_team_members_user_team_lookup ON public.hackathon_team_members (user_id, team_id)';
  END IF;

  IF to_regclass('public.hackathon_team_invites') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_team_invites_received_lookup ON public.hackathon_team_invites (event_id, invited_user_id, status, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_team_invites_sent_lookup ON public.hackathon_team_invites (event_id, invited_by, status)';
  END IF;

  IF to_regclass('public.hackathon_profiles') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_profiles_event_user_lookup ON public.hackathon_profiles (event_id, user_id)';
  END IF;

  IF to_regclass('public.hackathon_scores') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_scores_event_created_lookup ON public.hackathon_scores (event_id, created_at)';
  END IF;

  IF to_regclass('public.hackathon_chat_channels') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_chat_channels_event_type_lookup ON public.hackathon_chat_channels (event_id, channel_type, position)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_chat_channels_event_team_lookup ON public.hackathon_chat_channels (event_id, team_id) WHERE team_id IS NOT NULL';
  END IF;

  IF to_regclass('public.hackathon_chat_messages') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_chat_messages_event_channel_lookup ON public.hackathon_chat_messages (event_id, channel_id, created_at DESC) WHERE deleted_at IS NULL';
  END IF;

  IF to_regclass('public.hackathon_chat_reactions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hackathon_chat_reactions_message_user_lookup ON public.hackathon_chat_reactions (message_id, user_id)';
  END IF;

  IF to_regclass('public.mentors') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mentors_event_display_lookup ON public.mentors (event_id, display_order, created_at)';
  END IF;

  IF to_regclass('public.demo_slots') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_demo_slots_event_mentor_starts_lookup ON public.demo_slots (event_id, mentor_id, starts_at)';
  END IF;

  IF to_regclass('public.demo_slot_signups') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_demo_slot_signups_event_user_lookup ON public.demo_slot_signups (event_id, user_id)';
  END IF;

  IF to_regclass('public.cursor_credits') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cursor_credits_event_assigned_lookup ON public.cursor_credits (event_id, assigned_to)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cursor_credits_event_unassigned_lookup ON public.cursor_credits (event_id, created_at) WHERE assigned_to IS NULL';
  END IF;

  IF to_regclass('public.competitions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_competitions_event_created_lookup ON public.competitions (event_id, created_at)';
  END IF;

  IF to_regclass('public.competition_entries') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_competition_entries_competition_created_lookup ON public.competition_entries (competition_id, created_at)';
  END IF;

  IF to_regclass('public.polls') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_polls_event_active_lookup ON public.polls (event_id, is_active)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN EXECUTE 'ANALYZE public.events'; END IF;
  IF to_regclass('public.registrations') IS NOT NULL THEN EXECUTE 'ANALYZE public.registrations'; END IF;
  IF to_regclass('public.table_registrations') IS NOT NULL THEN EXECUTE 'ANALYZE public.table_registrations'; END IF;
  IF to_regclass('public.suggested_group_members') IS NOT NULL THEN EXECUTE 'ANALYZE public.suggested_group_members'; END IF;
  IF to_regclass('public.suggested_groups') IS NOT NULL THEN EXECUTE 'ANALYZE public.suggested_groups'; END IF;
  IF to_regclass('public.hackathon_teams') IS NOT NULL THEN EXECUTE 'ANALYZE public.hackathon_teams'; END IF;
  IF to_regclass('public.hackathon_team_members') IS NOT NULL THEN EXECUTE 'ANALYZE public.hackathon_team_members'; END IF;
  IF to_regclass('public.hackathon_team_invites') IS NOT NULL THEN EXECUTE 'ANALYZE public.hackathon_team_invites'; END IF;
  IF to_regclass('public.hackathon_profiles') IS NOT NULL THEN EXECUTE 'ANALYZE public.hackathon_profiles'; END IF;
  IF to_regclass('public.hackathon_chat_messages') IS NOT NULL THEN EXECUTE 'ANALYZE public.hackathon_chat_messages'; END IF;
END $$;
