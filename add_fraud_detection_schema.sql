-- Database schema for YouTube Video Tasks with Anti-Fraud System
-- Execute in Supabase SQL Editor

-- =====================================================
-- STEP 1: Add new columns to tasks table for video tasks
-- =====================================================

-- Add task_type column to enable YouTube video tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'link' CHECK (task_type IN ('link', 'video'));

-- Add required_time column for video tasks (in seconds, default 1m30s)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS required_time INTEGER DEFAULT 90;

-- Add youtube_video_id column for easier video identification
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

-- Add reward_amount column for custom task rewards
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS reward_amount DECIMAL(10,2) DEFAULT 50.00;

-- =====================================================
-- STEP 2: Add new columns to task_submissions table for fraud detection
-- =====================================================

-- Add watched_time column to track user video watch time
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS watched_time INTEGER DEFAULT 0;

-- Add unique_comment_code column for the randomly generated code
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS unique_comment_code TEXT;

-- Add screenshot_uploaded column to track if screenshot was provided
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS screenshot_uploaded BOOLEAN DEFAULT false;

-- Add start_time column to track when user started the task
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;

-- Add risk_score column for fraud risk assessment (0-100)
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- Add fraud_alert column to store fraud status: 'confiavel', 'suspeita', or null
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS fraud_alert TEXT CHECK (fraud_alert IN ('confiavel', 'suspeita', null));

-- Add validated_by column for admin who validated the task
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id);

-- Add validated_at column for validation timestamp
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- Add ocr_extracted_code column for OCR extracted code from screenshot
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS ocr_extracted_code TEXT;

-- Add ocr_confidence column for OCR confidence score
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS ocr_confidence REAL;

-- Add device_fingerprint column for device identification
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Add ip_address column for IP tracking (for fraud detection)
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- =====================================================
-- STEP 3: Create device_fingerprints table for fraud detection
-- =====================================================

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL,
    browser_info TEXT,
    os_info TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    language TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_hash)
);

-- Enable RLS
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_fingerprints
DROP POLICY IF EXISTS "Users can view own fingerprints" ON public.device_fingerprints;
CREATE POLICY "Users can view own fingerprints" ON public.device_fingerprints
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fingerprints" ON public.device_fingerprints;
CREATE POLICY "Users can insert own fingerprints" ON public.device_fingerprints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own fingerprints" ON public.device_fingerprints;
CREATE POLICY "Users can update own fingerprints" ON public.device_fingerprints
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all fingerprints" ON public.device_fingerprints;
CREATE POLICY "Admins can view all fingerprints" ON public.device_fingerprints
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- =====================================================
-- STEP 4: Create task_submissions_duplicate_check view
-- =====================================================

CREATE OR REPLACE VIEW public.task_submissions_with_risk AS
SELECT 
    ts.*,
    t.title as task_title,
    t.url as task_url,
    t.task_type,
    t.required_time,
    p.full_name as user_name,
    p.email as user_email,
    CASE 
        WHEN ts.risk_score >= 70 THEN 'ALTO RISCO'
        WHEN ts.risk_score >= 40 THEN 'MÉDIO RISCO'
        ELSE 'BAIXO RISCO'
    END as risk_level,
    CASE 
        WHEN ts.fraud_alert = 'suspeita' THEN '🔴 SUSPEITA'
        WHEN ts.fraud_alert = 'confiavel' THEN '🟢 CONFIÁVEL'
        ELSE '⚪ PENDENTE'
    END as fraud_status
FROM public.task_submissions ts
LEFT JOIN public.tasks t ON ts.task_id = t.id
LEFT JOIN public.profiles p ON ts.user_id = p.id
ORDER BY ts.created_at DESC;

-- =====================================================
-- STEP 5: Create function to check for duplicate IPs
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_duplicate_ip(p_task_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_current_ip TEXT;
BEGIN
    -- Get the current user's IP from their latest submission
    SELECT ip_address INTO v_current_ip
    FROM public.task_submissions
    WHERE task_id = p_task_id AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_current_ip IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Count other users with same IP for this task
    SELECT COUNT(DISTINCT user_id) - 1 INTO v_count
    FROM public.task_submissions
    WHERE task_id = p_task_id 
    AND ip_address = v_current_ip
    AND user_id != p_user_id;
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 6: Create function to calculate fraud risk score
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_fraud_risk(
    p_task_id UUID, 
    p_user_id UUID, 
    p_watched_time INTEGER,
    p_required_time INTEGER,
    p_ip_address TEXT,
    p_device_fingerprint TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_risk_score INTEGER := 0;
    v_duplicate_ip_count INTEGER;
    v_duplicate_device_count INTEGER;
    v_watch_ratio REAL;
BEGIN
    -- Risk 1: Watch time too short (< 80% of required)
    IF p_watched_time < (p_required_time * 0.8) THEN
        v_risk_score := v_risk_score + 30;
    ELSIF p_watched_time < p_required_time THEN
        v_risk_score := v_risk_score + 15;
    END IF;
    
    -- Risk 2: Duplicate IP (same IP used by multiple users)
    SELECT COUNT(DISTINCT user_id) - 1 INTO v_duplicate_ip_count
    FROM public.task_submissions
    WHERE task_id = p_task_id 
    AND ip_address = p_ip_address
    AND user_id != p_user_id;
    
    IF v_duplicate_ip_count > 0 THEN
        v_risk_score := v_risk_score + (30 * LEAST(v_duplicate_ip_count, 3));
    END IF;
    
    -- Risk 3: Duplicate device fingerprint
    SELECT COUNT(DISTINCT user_id) - 1 INTO v_duplicate_device_count
    FROM public.task_submissions
    WHERE task_id = p_task_id 
    AND device_fingerprint = p_device_fingerprint
    AND user_id != p_user_id;
    
    IF v_duplicate_device_count > 0 THEN
        v_risk_score := v_risk_score + (50 * LEAST(v_duplicate_device_count, 2));
    END IF;
    
    -- Cap risk score at 100
    RETURN LEAST(v_risk_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Add indexes for better query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_task_submissions_task_user 
ON public.task_submissions(task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_task_submissions_ip 
ON public.task_submissions(ip_address);

CREATE INDEX IF NOT EXISTS idx_task_submissions_fingerprint 
ON public.task_submissions(device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_task_submissions_fraud_alert 
ON public.task_submissions(fraud_alert);

CREATE INDEX IF NOT EXISTS idx_task_submissions_risk_score 
ON public.task_submissions(risk_score);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash 
ON public.device_fingerprints(device_hash);

-- =====================================================
-- Verification queries
-- =====================================================

-- Verify new columns in tasks table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('task_type', 'required_time', 'youtube_video_id', 'reward_amount');

-- Verify new columns in task_submissions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_submissions' 
AND column_name IN ('watched_time', 'unique_comment_code', 'screenshot_uploaded', 
                    'start_time', 'risk_score', 'fraud_alert', 'validated_by', 
                    'validated_at', 'ocr_extracted_code', 'ocr_confidence',
                    'device_fingerpint', 'ip_address');

-- Verify device_fingerprints table
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'device_fingerprints';
