-- Simple fix: Disable RLS on all tables to test if RLS is causing 500 errors
-- Run this in Supabase SQL Editor

-- Disable RLS on all tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE ads DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE opened_tasks DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relkind = 'r'
AND relname IN ('profiles', 'task_submissions', 'support_messages', 'ads', 'withdrawals', 'tasks', 'opened_tasks');
