-- Add is_judge flag to mentors table
-- Judges appear on the /hackathon/judges page; mentors appear on /hackathon/mentors

ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS is_judge boolean DEFAULT false;

UPDATE public.mentors
SET is_judge = true
WHERE title ILIKE '%Judge%';
