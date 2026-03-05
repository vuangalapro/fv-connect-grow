-- Add penalty_credit and is_banned columns to profiles table if they don't exist

-- Add penalty_credit column (default 100)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS penalty_credit INTEGER DEFAULT 100;

-- Add is_banned column (default false)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- Update existing users to have penalty_credit = 100 if null
UPDATE profiles SET penalty_credit = 100 WHERE penalty_credit IS NULL;

-- Update existing users to have is_banned = false if null
UPDATE profiles SET is_banned = false WHERE is_banned IS NULL;

-- Add RLS policies for the new columns (optional - if RLS is enabled)
-- These are typically handled by the existing policies, but just in case:

-- Allow users to read their own penalty_credit and is_banned
DROP POLICY IF EXISTS "Users can read own penalty_credit" ON profiles;
CREATE POLICY "Users can read own penalty_credit" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile (including penalty_credit and is_banned via admin)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow admins to do everything
DROP POLICY IF EXISTS "Admins can do everything profiles" ON profiles;
CREATE POLICY "Admins can do everything profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Set default values for new users
ALTER TABLE profiles ALTER COLUMN penalty_credit SET DEFAULT 100;
ALTER TABLE profiles ALTER COLUMN is_banned SET DEFAULT false;
