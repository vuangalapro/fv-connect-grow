-- Add task_type column to enable YouTube video tasks
-- Execute in Supabase SQL Editor

-- Step 1: Add task_type column if not exists
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'link' CHECK (task_type IN ('link', 'video'));

-- Step 2: Add required_time column for video tasks (in seconds)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS required_time INTEGER DEFAULT 90;

-- Step 3: Add watched_time column to track user video watch time
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS watched_time INTEGER DEFAULT 0;

-- Step 4: Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('task_type', 'required_time');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_submissions' AND column_name = 'watched_time';

-- Step 5: Allow updating watched_time via RLS
-- (The existing RLS policies should allow this, but let's verify)
