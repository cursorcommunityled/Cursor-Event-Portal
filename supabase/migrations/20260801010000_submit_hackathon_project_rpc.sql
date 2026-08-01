-- Atomic hackathon project submit: primary row + backup in one transaction.

CREATE OR REPLACE FUNCTION public.submit_hackathon_project(
  p_event_id uuid,
  p_team_id uuid,
  p_submitted_by uuid,
  p_team_name text,
  p_project_name text,
  p_description text,
  p_repo_url text,
  p_demo_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := NOW();
  v_existing RECORD;
  v_project_id uuid;
BEGIN
  IF p_project_name IS NULL OR length(trim(p_project_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Project name is required');
  END IF;

  IF p_repo_url IS NULL OR length(trim(p_repo_url)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A public GitHub repository URL is required');
  END IF;

  SELECT id, name, description, repo_url, demo_url, submitted_at
  INTO v_existing
  FROM hackathon_projects
  WHERE team_id = p_team_id AND event_id = p_event_id
  LIMIT 1;

  IF v_existing.submitted_at IS NOT NULL THEN
    -- Idempotent same-payload resubmit
    IF lower(trim(coalesce(v_existing.name, ''))) = lower(trim(p_project_name))
       AND lower(trim(coalesce(v_existing.description, ''))) = lower(trim(coalesce(p_description, '')))
       AND lower(regexp_replace(trim(coalesce(v_existing.repo_url, '')), '/$', ''))
           = lower(regexp_replace(trim(p_repo_url), '/$', ''))
       AND lower(trim(coalesce(v_existing.demo_url, ''))) = lower(trim(coalesce(p_demo_url, '')))
    THEN
      INSERT INTO hackathon_repo_submission_backups AS b (
        event_id, team_id, submitted_by, team_name, project_name, description,
        repo_url, demo_url, primary_project_saved, primary_project_error,
        submission_payload, submitted_at, updated_at
      ) VALUES (
        p_event_id, p_team_id, p_submitted_by, p_team_name, trim(p_project_name), p_description,
        trim(p_repo_url), p_demo_url, true, null,
        jsonb_build_object(
          'name', trim(p_project_name),
          'description', p_description,
          'repo_url', trim(p_repo_url),
          'demo_url', p_demo_url,
          'submitted_at', v_existing.submitted_at
        ),
        v_existing.submitted_at, v_now
      )
      ON CONFLICT (event_id, team_id) DO UPDATE SET
        submitted_by = EXCLUDED.submitted_by,
        team_name = EXCLUDED.team_name,
        project_name = EXCLUDED.project_name,
        description = EXCLUDED.description,
        repo_url = EXCLUDED.repo_url,
        demo_url = EXCLUDED.demo_url,
        primary_project_saved = true,
        primary_project_error = null,
        submission_payload = EXCLUDED.submission_payload,
        updated_at = v_now;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'project_id', v_existing.id,
        'submitted_at', v_existing.submitted_at,
        'repo_url', v_existing.repo_url
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'This team already has a submitted project. Cancel it before submitting changes.'
    );
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE hackathon_projects
    SET
      name = trim(p_project_name),
      description = p_description,
      repo_url = trim(p_repo_url),
      demo_url = p_demo_url,
      submitted_at = v_now,
      updated_at = v_now
    WHERE id = v_existing.id
      AND submitted_at IS NULL
    RETURNING id INTO v_project_id;

    IF v_project_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'This team already has a submitted project. Refresh to see the latest submission.'
      );
    END IF;
  ELSE
    INSERT INTO hackathon_projects (
      team_id, event_id, name, description, repo_url, demo_url,
      submitted_at, created_at, updated_at
    ) VALUES (
      p_team_id, p_event_id, trim(p_project_name), p_description, trim(p_repo_url), p_demo_url,
      v_now, v_now, v_now
    )
    RETURNING id INTO v_project_id;
  END IF;

  INSERT INTO hackathon_repo_submission_backups AS b (
    event_id, team_id, submitted_by, team_name, project_name, description,
    repo_url, demo_url, primary_project_saved, primary_project_error,
    submission_payload, submitted_at, updated_at
  ) VALUES (
    p_event_id, p_team_id, p_submitted_by, p_team_name, trim(p_project_name), p_description,
    trim(p_repo_url), p_demo_url, true, null,
    jsonb_build_object(
      'name', trim(p_project_name),
      'description', p_description,
      'repo_url', trim(p_repo_url),
      'demo_url', p_demo_url,
      'submitted_at', v_now
    ),
    v_now, v_now
  )
  ON CONFLICT (event_id, team_id) DO UPDATE SET
    submitted_by = EXCLUDED.submitted_by,
    team_name = EXCLUDED.team_name,
    project_name = EXCLUDED.project_name,
    description = EXCLUDED.description,
    repo_url = EXCLUDED.repo_url,
    demo_url = EXCLUDED.demo_url,
    primary_project_saved = true,
    primary_project_error = null,
    submission_payload = EXCLUDED.submission_payload,
    submitted_at = EXCLUDED.submitted_at,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'project_id', v_project_id,
    'submitted_at', v_now,
    'repo_url', trim(p_repo_url)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'This team already has a submitted project. Refresh to see the latest submission.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_hackathon_project(
  uuid, uuid, uuid, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_hackathon_project(
  uuid, uuid, uuid, text, text, text, text, text
) TO service_role;
