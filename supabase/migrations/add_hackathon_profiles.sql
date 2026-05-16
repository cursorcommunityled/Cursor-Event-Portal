-- Hackathon Profiles - survey data imported from Luma CSV
-- Fields map to the Luma guest CSV survey columns

CREATE TABLE IF NOT EXISTS public.hackathon_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id         uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occupation       text,
  is_technical     boolean,
  unique_skill     text,
  linkedin_url     text,
  needs_team       boolean     NOT NULL DEFAULT false,
  accessibility    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_profiles_event_needs_team
  ON public.hackathon_profiles(event_id, needs_team);

CREATE INDEX IF NOT EXISTS idx_hackathon_profiles_user_event
  ON public.hackathon_profiles(user_id, event_id);

ALTER TABLE public.hackathon_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_hackathon_profiles" ON public.hackathon_profiles;

CREATE POLICY "service_role_hackathon_profiles"
  ON public.hackathon_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_hackathon_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hackathon_profiles_updated_at ON public.hackathon_profiles;

CREATE TRIGGER trg_hackathon_profiles_updated_at
  BEFORE UPDATE ON public.hackathon_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_hackathon_profiles_updated_at();
