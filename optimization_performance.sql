-- =====================================================
-- PERFORMANCE OPTIMIZATION AND REFACTORING
-- =====================================================
-- Execute this SQL in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. REMOVE OLD CODE SYSTEM COLUMNS
-- =====================================================

-- Drop old columns if they exist (safe - only drops if exists)
ALTER TABLE task_submissions DROP COLUMN IF EXISTS auto_code;
ALTER TABLE task_submissions DROP COLUMN IF EXISTS code_verified;

-- Drop old table if exists
DROP TABLE IF EXISTS affiliate_auto_codes;

-- =====================================================
-- 2. ADD PERFORMANCE COLUMNS
-- =====================================================

-- Add score cache columns to task_submissions
ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS score_cache INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS flags_cache JSONB DEFAULT '[]';

-- =====================================================
-- 3. CREATE PERFORMANCE INDEXES
-- =====================================================

-- Task submissions indexes
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_task_submissions_created ON task_submissions(created_at DESC);

-- Affiliate penalties indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_penalties_user_id ON affiliate_penalties(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_penalties_task ON affiliate_penalties(task_submission_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_penalties_date ON affiliate_penalties(applied_at DESC);

-- Video clicks indexes
CREATE INDEX IF NOT EXISTS idx_video_clicks_ip ON video_clicks(ip_address);
CREATE INDEX IF NOT EXISTS idx_video_clicks_user ON video_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_video_clicks_task ON video_clicks(task_id);
CREATE INDEX IF NOT EXISTS idx_video_clicks_date ON video_clicks(clicked_at DESC);

-- Affiliate devices indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_devices_user ON affiliate_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_devices_fingerprint ON affiliate_devices(device_fingerprint);

-- Admin reviews indexes
CREATE INDEX IF NOT EXISTS idx_admin_reviews_submission ON admin_task_reviews(task_submission_id);
CREATE INDEX IF NOT EXISTS idx_admin_reviews_user ON admin_task_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_reviews_reviewer ON admin_task_reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_admin_reviews_date ON admin_task_reviews(reviewed_at DESC);

-- =====================================================
-- 4. ANTIFRAUD SCORE CALCULATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_antifraud_score(
    p_user_id UUID,
    p_ip TEXT,
    p_fingerprint TEXT,
    p_task_id UUID
)
RETURNS TABLE(
    score INT,
    flags JSONB,
    ip_shared BOOLEAN,
    device_shared BOOLEAN,
    shared_users INT,
    shared_devices INT
) AS $$
DECLARE
    v_score INT := 100;
    v_flags JSONB := '[]'::JSONB;
    v_ip_shared BOOLEAN := false;
    v_device_shared BOOLEAN := false;
    v_shared_users INT := 0;
    v_shared_devices INT := 0;
    v_ip_count INT;
    v_device_count INT;
BEGIN
    -- Check IP sharing (informational only, not severe)
    SELECT COUNT(DISTINCT user_id) INTO v_ip_count
    FROM video_clicks
    WHERE ip_address = p_ip
    AND user_id != p_user_id;

    IF v_ip_count > 0 THEN
        v_score := v_score - 10;
        v_flags := v_flags || '"IP_SHARED"'::JSONB;
        v_ip_shared := true;
        v_shared_users := v_ip_count;
    END IF;

    -- Check device sharing (more severe)
    SELECT COUNT(DISTINCT user_id) INTO v_device_count
    FROM affiliate_devices
    WHERE device_fingerprint = p_fingerprint
    AND user_id != p_user_id;

    IF v_device_count > 0 THEN
        v_score := v_score - 20;
        v_flags := v_flags || '"DEVICE_SHARED"'::JSONB;
        v_device_shared := true;
        v_shared_devices := v_device_count;

        -- If 3+ users on same device = automatic fraud
        IF v_device_count >= 2 THEN
            v_score := v_score - 40;
            v_flags := v_flags || '"MULTI_ACCOUNT"'::JSONB;
        END IF;
    END IF;

    -- Check for existing penalties
    DECLARE v_penalty_count INT;
    BEGIN
        SELECT COUNT(*) INTO v_penalty_count
        FROM affiliate_penalties
        WHERE user_id = p_user_id;

        IF v_penalty_count > 0 THEN
            v_score := v_score - (v_penalty_count * 10);
            v_flags := v_flags || '"HAS_PENALTIES"'::JSONB;
        END IF;
    END;

    -- Ensure score doesn't go below 0
    v_score := GREATEST(0, v_score);

    -- Return results
    RETURN QUERY SELECT v_score, v_flags, v_ip_shared, v_device_shared, v_shared_users, v_shared_devices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. PRE-CALCULATE SCORE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION precalculate_task_score(
    p_task_submission_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_submission RECORD;
    v_score INT;
    v_flags JSONB;
    v_ip_shared BOOLEAN;
    v_device_shared BOOLEAN;
    v_shared_users INT;
    v_shared_devices INT;
BEGIN
    -- Get submission data
    SELECT * INTO v_submission
    FROM task_submissions
    WHERE id = p_task_submission_id;

    IF v_submission IS NULL THEN
        RETURN;
    END IF;

    -- Calculate score
    SELECT * INTO (v_score, v_flags, v_ip_shared, v_device_shared, v_shared_users, v_shared_devices)
    FROM calculate_antifraud_score(
        v_submission.user_id,
        v_submission.client_ip,
        v_submission.device_fingerprint,
        v_submission.task_id
    );

    -- Update submission with cached score
    UPDATE task_submissions
    SET score_cache = v_score,
        flags_cache = v_flags,
        ip_shared = v_ip_shared,
        device_shared = v_device_shared
    WHERE id = p_task_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. TRIGGER FOR AUTO SCORE CALCULATION
-- =====================================================

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_calculate_task_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate score for new or updated submissions
    IF NEW.client_ip IS NOT NULL OR NEW.device_fingerprint IS NOT NULL THEN
        PERFORM precalculate_task_score(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (if not exists)
DROP TRIGGER IF EXISTS trigger_task_score ON task_submissions;
CREATE TRIGGER trigger_task_score
    AFTER INSERT OR UPDATE OF client_ip, device_fingerprint
    ON task_submissions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_task_score();

-- =====================================================
-- 7. OPTIMIZED VIEW FOR ADMIN DASHBOARD
-- =====================================================

CREATE OR REPLACE VIEW v_admin_task_submissions AS
SELECT 
    ts.id as submission_id,
    ts.task_id,
    ts.user_id,
    t.title as task_title,
    t.url as task_url,
    p.full_name as affiliate_name,
    p.email as affiliate_email,
    ts.status,
    ts.created_at,
    ts.screenshot_url,
    ts.watched_time,
    ts.client_ip,
    ts.device_fingerprint,
    ts.score_cache as fraud_score,
    ts.flags_cache as fraud_flags,
    ts.ip_shared,
    ts.device_shared,
    prof.penalty_credit,
    prof.affiliate_status
FROM task_submissions ts
LEFT JOIN tasks t ON t.id = ts.task_id
LEFT JOIN profiles p ON p.id = ts.user_id
LEFT JOIN profiles prof ON prof.id = ts.user_id
ORDER BY ts.created_at DESC;

-- =====================================================
-- 8. AGGREGATED VIEW FOR AFFILIATE STATS
-- =====================================================

CREATE OR REPLACE VIEW v_affiliate_stats AS
SELECT 
    p.id as affiliate_id,
    p.full_name,
    p.email,
    p.penalty_credit,
    p.affiliate_status,
    COALESCE(t_stats.tasks_count, 0) as tasks_count,
    COALESCE(t_stats.approved_count, 0) as approved_count,
    COALESCE(t_stats.pending_count, 0) as pending_count,
    COALESCE(t_stats.rejected_count, 0) as rejected_count,
    COALESCE(p_stats.avg_score, 100) as avg_fraud_score,
    COALESCE(pen_stats.penalty_count, 0) as penalty_count,
    COALESCE(dev_stats.device_count, 0) as device_count
FROM profiles p
LEFT JOIN (
    SELECT user_id, 
           COUNT(*) as tasks_count,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM task_submissions
    GROUP BY user_id
) t_stats ON t_stats.user_id = p.id
LEFT JOIN (
    SELECT user_id,
           AVG(score_cache)::INT as avg_score
    FROM task_submissions
    WHERE score_cache IS NOT NULL
    GROUP BY user_id
) p_stats ON p_stats.user_id = p.id
LEFT JOIN (
    SELECT user_id,
           COUNT(*) as penalty_count
    FROM affiliate_penalties
    GROUP BY user_id
) pen_stats ON pen_stats.user_id = p.id
LEFT JOIN (
    SELECT user_id,
           COUNT(*) as device_count
    FROM affiliate_devices
    GROUP BY user_id
) dev_stats ON dev_stats.user_id = p.id
WHERE p.is_admin = false;

-- =====================================================
-- VERIFY OPTIMIZATIONS
-- =====================================================

SELECT 'Performance optimization complete!' as message;

-- List all indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
