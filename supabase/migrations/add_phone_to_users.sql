-- Add phone number to users table for Ops Copilot staff alert SMS
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Example: set your admin phone numbers after running this migration
-- UPDATE users SET phone = '+1xxxxxxxxxx' WHERE role = 'admin' AND email = 'you@example.com';
