-- Fix Supabase RLS and table issues causing 500 errors
-- Run this in Supabase SQL Editor

-- ============================================
-- FIX 1: Create proper RLS policies for profiles
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything profiles" ON profiles;

-- Allow authenticated users to read all profiles
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins to do everything
CREATE POLICY "Admins can do everything profiles" ON profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- FIX 2: Create RLS policies for task_submissions
-- ============================================

DROP POLICY IF EXISTS "Users can view all submissions" ON task_submissions;
DROP POLICY IF EXISTS "Users can insert submissions" ON task_submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON task_submissions;
DROP POLICY IF EXISTS "Admins can do everything submissions" ON task_submissions;

CREATE POLICY "Users can view all submissions" ON task_submissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert submissions" ON task_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own submissions" ON task_submissions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can do everything submissions" ON task_submissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- FIX 3: Create RLS policies for support_messages
-- ============================================

DROP POLICY IF EXISTS "Users can view own messages" ON support_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can do everything messages" ON support_messages;

CREATE POLICY "Users can view own messages" ON support_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert messages" ON support_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can do everything messages" ON support_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- FIX 4: Create RLS policies for ads
-- ============================================

DROP POLICY IF EXISTS "Users can view ads" ON ads;
DROP POLICY IF EXISTS "Admins can do everything ads" ON ads;

CREATE POLICY "Users can view ads" ON ads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can do everything ads" ON ads
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- FIX 5: Enable RLS on all tables if not enabled
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

-- Verify tables exist and have correct structure
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'task_submissions', 'support_messages', 'ads')
ORDER BY table_name, ordinal_position;
