-- Ensure SAIT outreach coordinators can access the admin portal.
-- Password auth is still handled by Supabase Auth; this only grants portal admin authorization.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

WITH outreach_admins(email, name) AS (
  VALUES
    ('ethan.bayarsaikhan@edu.sait.ca', 'Ethan Bayarsaikhan'),
    ('mayurrajendrakumar.brahmbhatt@edu.sait.ca', 'Mayur Rajendrakumar Brahmbhatt')
)
INSERT INTO public.admin_emails (email)
SELECT email
FROM outreach_admins
ON CONFLICT (email) DO NOTHING;

WITH outreach_admins(email, name) AS (
  VALUES
    ('ethan.bayarsaikhan@edu.sait.ca', 'Ethan Bayarsaikhan'),
    ('mayurrajendrakumar.brahmbhatt@edu.sait.ca', 'Mayur Rajendrakumar Brahmbhatt')
)
UPDATE public.users AS public_user
SET
  role = 'admin',
  name = COALESCE(NULLIF(public_user.name, ''), outreach_admins.name),
  updated_at = NOW()
FROM outreach_admins
WHERE LOWER(public_user.email) = outreach_admins.email;

WITH outreach_admins(email, name) AS (
  VALUES
    ('ethan.bayarsaikhan@edu.sait.ca', 'Ethan Bayarsaikhan'),
    ('mayurrajendrakumar.brahmbhatt@edu.sait.ca', 'Mayur Rajendrakumar Brahmbhatt')
)
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT
  COALESCE(auth_user.id, gen_random_uuid()),
  outreach_admins.email,
  outreach_admins.name,
  'admin',
  NOW(),
  NOW()
FROM outreach_admins
LEFT JOIN auth.users AS auth_user
  ON LOWER(auth_user.email) = outreach_admins.email
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users AS existing_user
  WHERE LOWER(existing_user.email) = outreach_admins.email
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
  updated_at = NOW();
