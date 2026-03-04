-- Create table for YouTube Visual Analysis Audit
CREATE TABLE IF NOT EXISTS visual_analysis_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  user_id UUID REFERENCES profiles(id),
  like_detected BOOLEAN DEFAULT false,
  subscribe_detected BOOLEAN DEFAULT false,
  theme_detected TEXT DEFAULT 'dark',
  language_detected TEXT DEFAULT 'en',
  confidence DECIMAL(3,2) DEFAULT 0,
  roi JSONB,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE visual_analysis_audit ENABLE ROW LEVEL SECURITY;

-- Allow admins to do everything
CREATE POLICY "Admins can manage visual_analysis_audit"
  ON visual_analysis_audit
  FOR ALL
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_visual_analysis_audit_task_id ON visual_analysis_audit(task_id);
CREATE INDEX IF NOT EXISTS idx_visual_analysis_audit_user_id ON visual_analysis_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_visual_analysis_audit_created_at ON visual_analysis_audit(created_at DESC);
