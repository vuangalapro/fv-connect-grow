-- Add created_at column to ads table if it doesn't exist
ALTER TABLE ads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Also add updated_at for consistency
ALTER TABLE ads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
