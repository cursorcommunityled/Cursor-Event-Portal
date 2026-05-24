-- SQL script to allow-list admin/judge users for Cursor Popup portal.
-- Run this in the Supabase SQL Editor after creating the matching Auth users.
-- Shared temporary password for Auth users: CursorCalgary2026

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE IF NOT EXISTS tmp_admin_credentials (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL
) ON COMMIT DROP;

TRUNCATE tmp_admin_credentials;

INSERT INTO tmp_admin_credentials (email, name)
VALUES
  -- Organizers / existing admins
  ('ali.moussa@sait.ca', 'Ali Moussa'),
  ('cal@neweraintelligence.com', 'Cal Leung'),
  ('carterhjm@hotmail.com', 'Jia Ming Huang'),
  ('ineselspeth@gmail.com', 'Ines Elspeth'),
  ('megabytesait@gmail.com', 'Megabyte SAIT'),
  ('megabytesait@outlook.com', 'Megabyte SAIT'),
  ('simonloewen@gmail.com', 'Simon Loewen'),
  ('simon@neweraintelligence.com', 'Simon Loewen'),

  -- SAIT May 2026 judges / mentors
  ('dogru@ualberta.ca', 'Oguzhan Dogru'),
  ('jia@jiaminghuang.com', 'Jia Ming Huang'),
  ('au@tsuin.ai', 'Audrey Aui Yong'),
  ('alexyoung612@gmail.com', 'Alex Young'),
  ('trystan@saleslinkstrategies.com', 'Trystan Keller'),
  ('dlynch@openhouse.ai', 'David Lynch'),
  ('ethan.bayarsaikhan@edu.sait.ca', 'Ethan Bayarsaikhan'),
  ('mayurrajendrakumar.brahmbhatt@edu.sait.ca', 'Mayur Rajendrakumar Brahmbhatt'),
  ('smijalmathewthomas@edu.sait.ca', 'Smijal Mathew Thomas'),
  ('dilshadineshan@edu.sait.ca', 'Dilshad Ineshan'),
  ('apalamattam@google.com', 'Anvil Palamattam'),
  ('suprita.shankar@gmail.com', 'Suprita Shankar'),
  ('nawroz.riti@gmail.com', 'Riti Nawroz'),
  ('fatema.chowdhury@ucalgary.ca', 'Fatema Chowdhury'),
  ('aditya.thakur@salesforce.com', 'Aditya Thakur')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name;

-- If the Auth users already exist, force the intended temporary password and
-- mark emails confirmed so password login works immediately.
UPDATE auth.users AS auth_user
SET
  encrypted_password = crypt('CursorCalgary2026', gen_salt('bf')),
  email_confirmed_at = COALESCE(auth_user.email_confirmed_at, NOW()),
  updated_at = NOW()
FROM tmp_admin_credentials AS admin_user
WHERE LOWER(auth_user.email) = admin_user.email;

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: admin_emails is the admin allow-list and must not be readable by anon.
-- Server code checks this table with the service role.
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_emails (email)
SELECT email
FROM tmp_admin_credentials
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create/promote the public user rows used by judging scorecards.
-- Existing public user IDs are preserved because many tables may reference them.
UPDATE public.users AS public_user
SET
  role = 'admin',
  name = COALESCE(NULLIF(public_user.name, ''), admin_user.name),
  updated_at = NOW()
FROM tmp_admin_credentials AS admin_user
WHERE LOWER(public_user.email) = admin_user.email;

INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT
  COALESCE(auth_user.id, gen_random_uuid()),
  admin_user.email,
  admin_user.name,
  'admin',
  NOW(),
  NOW()
FROM tmp_admin_credentials AS admin_user
LEFT JOIN auth.users AS auth_user
  ON LOWER(auth_user.email) = admin_user.email
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users AS existing_user
  WHERE LOWER(existing_user.email) = admin_user.email
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
  updated_at = NOW();

-- Verification: auth_user_exists must be true before that person can password-login.
SELECT
  admin_user.email,
  admin_user.name,
  (auth_user.id IS NOT NULL) AS auth_user_exists,
  public_user.role AS public_role,
  (admin_email.email IS NOT NULL) AS admin_allowlisted
FROM tmp_admin_credentials AS admin_user
LEFT JOIN auth.users AS auth_user
  ON LOWER(auth_user.email) = admin_user.email
LEFT JOIN public.users AS public_user
  ON LOWER(public_user.email) = admin_user.email
LEFT JOIN public.admin_emails AS admin_email
  ON admin_email.email = admin_user.email
ORDER BY admin_user.email;
