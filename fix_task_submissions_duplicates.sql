-- Fix task_submissions: Add unique constraint (user_id, task_id) to prevent duplicates
-- Execute this SQL in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Step 1: Check current table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_submissions';

-- Step 2: Find and delete duplicate submissions (keep only the oldest approved one, or oldest pending)
-- This query identifies duplicates
SELECT user_id, task_id, COUNT(*)
FROM public.task_submissions
GROUP BY user_id, task_id
HAVING COUNT(*) > 1;

-- Step 3: Delete duplicates - keep only the first submission per user/task
-- Keep the oldest record (with smallest id) using a different approach
DELETE FROM public.task_submissions
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, task_id ORDER BY created_at ASC, id ASC) as rn
    FROM public.task_submissions
  ) sub WHERE rn = 1
);

-- Step 4: Add unique constraint to prevent future duplicates
-- First, check if constraint already exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'task_submissions' 
AND constraint_type = 'UNIQUE';

-- Add unique constraint (this will fail if duplicates exist, which is why Step 3 is important)
ALTER TABLE public.task_submissions 
ADD CONSTRAINT unique_user_task_submission UNIQUE (user_id, task_id);

-- Step 5: Verify the constraint was added
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'task_submissions' 
AND constraint_type = 'UNIQUE';

-- Step 6: Check current data - verify each user has at most one submission per task
SELECT user_id, task_id, COUNT(*)
FROM public.task_submissions
GROUP BY user_id, task_id
HAVING COUNT(*) > 1;

-- Step 7: Verify RLS policies exist for task_submissions
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'task_submissions';

-- If no RLS policies exist, create them:
-- Allow users to insert their own submissions
CREATE POLICY "Users can insert their own task submissions"
ON public.task_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own submissions
CREATE POLICY "Users can view their own task submissions"
ON public.task_submissions FOR SELECT
USING (auth.uid() = user_id);

-- Allow admin to do everything
CREATE POLICY "Admin can do everything on task_submissions"
ON public.task_submissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Step 8: Ensure RLS is enabled
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

-- Verify everything is working
SELECT 
  tc.table_name, 
  tc.constraint_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'task_submissions'
AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE');
