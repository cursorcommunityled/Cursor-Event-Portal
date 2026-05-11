-- Ensure organizer accounts are admins.
-- This creates missing public user rows and promotes existing rows to admin.

INSERT INTO users (email, name, role, created_at)
VALUES
  ('ali.moussa@sait.ca', 'Ali Moussa', 'admin', NOW()),
  ('cal@neweraintelligence.com', 'Cal', 'admin', NOW()),
  ('carterhjm@hotmail.com', 'Carter', 'admin', NOW()),
  ('dogru@ualberta.ca', 'Dogru', 'admin', NOW()),
  ('ineselspeth@gmail.com', 'Ines Elspeth', 'admin', NOW()),
  ('jia@jiaminghuang.com', 'Jia', 'admin', NOW()),
  ('megabytesait@gmail.com', 'Megabyte SAIT', 'admin', NOW()),
  ('megabytesait@outlook.com', 'Megabyte SAIT', 'admin', NOW()),
  ('simon@neweraintelligence.com', 'Simon', 'admin', NOW())
ON CONFLICT (email)
DO UPDATE SET
  role = 'admin',
  name = COALESCE(NULLIF(users.name, ''), EXCLUDED.name);

-- Verify the admin users were created/updated.
SELECT id, email, name, role, created_at
FROM users
WHERE email IN (
  'ali.moussa@sait.ca',
  'cal@neweraintelligence.com',
  'carterhjm@hotmail.com',
  'dogru@ualberta.ca',
  'ineselspeth@gmail.com',
  'jia@jiaminghuang.com',
  'megabytesait@gmail.com',
  'megabytesait@outlook.com',
  'simon@neweraintelligence.com'
)
ORDER BY email;
