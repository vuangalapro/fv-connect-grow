-- Create screenshot_hashes table for duplicate detection
-- This prevents the same screenshot from being submitted multiple times

CREATE TABLE IF NOT EXISTS screenshot_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT NOT NULL,
  submission_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for fast hash lookups
CREATE INDEX IF NOT EXISTS idx_screenshot_hashes_hash ON screenshot_hashes(hash);
CREATE INDEX IF NOT EXISTS idx_screenshot_hashes_submission_id ON screenshot_hashes(submission_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_hashes_user_id ON screenshot_hashes(user_id);

-- Enable RLS
ALTER TABLE screenshot_hashes ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read (for checking duplicates)
CREATE POLICY "Anyone can read screenshot hashes"
  ON screenshot_hashes FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert their own hashes
CREATE POLICY "Users can insert their own screenshot hashes"
  ON screenshot_hashes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage screenshot hashes"
  ON screenshot_hashes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Add comments for documentation
COMMENT ON TABLE screenshot_hashes IS 'Stores SHA-256 hashes of submitted screenshots to detect duplicates';
COMMENT ON COLUMN screenshot_hashes.hash IS 'SHA-256 hash of the screenshot image';
COMMENT ON COLUMN screenshot_hashes.submission_id IS 'Reference to the task_submission that used this screenshot';
COMMENT ON COLUMN screenshot_hashes.user_id IS 'User who submitted the screenshot';
