-- Add watch_sessions column to task_submissions table
-- Execute this SQL in Supabase SQL Editor

ALTER TABLE public.task_submissions
ADD COLUMN IF NOT EXISTS watch_sessions JSONB;
