-- Make dogru@ualberta.ca an admin
INSERT INTO users (id, email, name, role, created_at)
VALUES (
  uuid_generate_v4(),
  'dogru@ualberta.ca',
  'Dogru',
  'admin',
  NOW()
)
ON CONFLICT (email)
DO UPDATE SET
  role = 'admin',
  name = COALESCE(users.name, EXCLUDED.name);

-- Verify
SELECT id, email, name, role, created_at
FROM users
WHERE email = 'dogru@ualberta.ca';
