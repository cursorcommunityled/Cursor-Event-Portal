-- SQL script to create admin users for Cursor Popup portal
-- Run this in Supabase SQL Editor with service role permissions

-- Create admin users in auth.users table
-- Password: CursorCalgary2026

-- First, delete existing users if they exist (to reset)
DELETE FROM auth.users WHERE email IN (
  'simonloewen@gmail.com',
  'cal@neweraintelligence.com',
  'jia@jiaminghuang.com',
  'carterhjm@hotmail.com'
);

-- Insert admin users with the password "CursorCalgary2026"
-- The password is hashed using bcrypt (Supabase's default)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change_token_current,
  email_change_token_new,
  recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'simonloewen@gmail.com',
    crypt('CursorCalgary2026', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'cal@neweraintelligence.com',
    crypt('CursorCalgary2026', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'jia@jiaminghuang.com',
    crypt('CursorCalgary2026', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'carterhjm@hotmail.com',
    crypt('CursorCalgary2026', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

-- Also add/update these users in the public.users table with admin role
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT
  au.id,
  au.email,
  split_part(au.email, '@', 1) as name,
  'admin' as role,
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email IN (
  'simonloewen@gmail.com',
  'cal@neweraintelligence.com',
  'jia@jiaminghuang.com',
  'carterhjm@hotmail.com'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

-- Create an admin_emails table for easy lookup (optional but useful)
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: admin_emails is the admin allow-list — must not be readable by the
-- anon client. Server code uses the service role (which bypasses RLS) to
-- check if a logged-in user's email is in this table.
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- Insert admin emails
INSERT INTO public.admin_emails (email) VALUES
  ('simonloewen@gmail.com'),
  ('cal@neweraintelligence.com'),
  ('jia@jiaminghuang.com'),
  ('carterhjm@hotmail.com')
ON CONFLICT (email) DO NOTHING;

-- Verify the users were created
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email IN (
  'simonloewen@gmail.com',
  'cal@neweraintelligence.com',
  'jia@jiaminghuang.com',
  'carterhjm@hotmail.com'
);
