-- Simple script to add penalty_credit and is_banned columns to profiles table
-- Run this in Supabase SQL Editor

-- Add penalty_credit column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'penalty_credit') THEN
        ALTER TABLE profiles ADD COLUMN penalty_credit INTEGER DEFAULT 100;
    END IF;
END $$;

-- Add is_banned column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_banned') THEN
        ALTER TABLE profiles ADD COLUMN is_banned BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('penalty_credit', 'is_banned');
