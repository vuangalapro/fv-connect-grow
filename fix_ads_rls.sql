-- Fix RLS policies for ads table to allow admin to read all ads

-- Enable RLS if not already enabled
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Allow public insert for ads" ON ads;
DROP POLICY IF EXISTS "Allow authenticated read for ads" ON ads;
DROP POLICY IF EXISTS "Allow admin update ads" ON ads;
DROP POLICY IF EXISTS "Allow admin delete ads" ON ads;

-- Create policy to allow anyone to insert ads (public form)
CREATE POLICY "Allow public insert for ads" ON ads
  FOR INSERT WITH CHECK (true);

-- Create policy to allow authenticated users to read ads
CREATE POLICY "Allow authenticated read for ads" ON ads
  FOR SELECT USING (true);

-- Create policy to allow admins to update ads
CREATE POLICY "Allow admin update ads" ON ads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Create policy to allow admins to delete ads
CREATE POLICY "Allow admin delete ads" ON ads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
