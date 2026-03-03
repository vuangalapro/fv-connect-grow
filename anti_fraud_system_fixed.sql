-- =====================================================
-- COMPLETE ANTI-FRAUD SYSTEM FOR AFFILIATE PLATFORM (FIXED)
-- =====================================================
-- Execute this SQL in Supabase SQL Editor
-- Uses user_id instead of affiliate_id to match existing schema
-- =====================================================

-- =====================================================
-- MODULE 1: AFFILIATE DEVICE FINGERPRINT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for device fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_devices_fingerprint ON affiliate_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_affiliate_devices_user ON affiliate_devices(user_id);

-- =====================================================
-- MODULE 2: VIDEO CLICKS TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS video_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    clicked_from_url TEXT,
    country TEXT,
    city TEXT,
    is_unique_click BOOLEAN DEFAULT true
);

-- Index for IP and user lookups
CREATE INDEX IF NOT EXISTS idx_video_clicks_ip ON video_clicks(ip_address);
CREATE INDEX IF NOT EXISTS idx_video_clicks_user ON video_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_video_clicks_task ON video_clicks(task_id);
CREATE INDEX IF NOT EXISTS idx_video_clicks_token ON video_clicks(token);

-- =====================================================
-- MODULE 3: AFFILIATE PENALTIES HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_submission_id UUID REFERENCES task_submissions(id) ON DELETE SET NULL,
    penalty_type TEXT NOT NULL,
    penalty_percent INT NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    system_flags JSONB DEFAULT '[]',
    applied_by UUID REFERENCES auth.users(id),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for penalty lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_penalties_user ON affiliate_penalties(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_penalties_task ON affiliate_penalties(task_submission_id);

-- =====================================================
-- MODULE 4: ADMIN TASK REVIEWS AUDIT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_task_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    system_score INT DEFAULT 100,
    system_flags JSONB DEFAULT '[]',
    ip_shared BOOLEAN DEFAULT false,
    device_shared BOOLEAN DEFAULT false,
    ua_match BOOLEAN DEFAULT false,
    yt_channel_reuse BOOLEAN DEFAULT false,
    admin_decision TEXT NOT NULL,
    admin_note TEXT,
    penalty_applied INT DEFAULT 0,
    affiliate_banned BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for review lookups
CREATE INDEX IF NOT EXISTS idx_admin_reviews_submission ON admin_task_reviews(task_submission_id);
CREATE INDEX IF NOT EXISTS idx_admin_reviews_user ON admin_task_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_reviews_reviewer ON admin_task_reviews(reviewed_by);

-- =====================================================
-- MODULE 5: ADD COLUMNS TO PROFILES
-- =====================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS penalty_credit INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS affiliate_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS total_penalties INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS fraud_score INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS last_fraud_check TIMESTAMPTZ;

-- =====================================================
-- MODULE 6: ADD COLUMNS TO TASK_SUBMISSIONS
-- =====================================================
ALTER TABLE public.task_submissions
ADD COLUMN IF NOT EXISTS click_id UUID REFERENCES video_clicks(id),
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS client_ip TEXT,
ADD COLUMN IF NOT EXISTS client_user_agent TEXT,
ADD COLUMN IF NOT EXISTS fraud_score INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ip_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS device_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS yt_channel_hash TEXT,
ADD COLUMN IF NOT EXISTS validated_by_admin UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS admin_review_id UUID REFERENCES admin_task_reviews(id);

-- =====================================================
-- MODULE 7: FUNCTIONS FOR FRAUD DETECTION
-- =====================================================

-- Function: Check if IP is shared by multiple users
CREATE OR REPLACE FUNCTION check_ip_shared(p_ip TEXT, p_user_id UUID)
RETURNS TABLE(shared_user_id UUID, ip_address TEXT, click_count INT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT vc.user_id, vc.ip_address, COUNT(vc.id)::INT as click_count
    FROM video_clicks vc
    WHERE vc.ip_address = p_ip
    AND vc.user_id != p_user_id
    GROUP BY vc.user_id, vc.ip_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if device is shared
CREATE OR REPLACE FUNCTION check_device_shared(p_fingerprint TEXT, p_user_id UUID)
RETURNS TABLE(shared_user_id UUID, fingerprint TEXT, device_count INT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ad.user_id, ad.device_fingerprint, COUNT(ad.id)::INT as device_count
    FROM affiliate_devices ad
    WHERE ad.device_fingerprint = p_fingerprint
    AND ad.user_id != p_user_id
    GROUP BY ad.user_id, ad.device_fingerprint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate fraud score for submission
CREATE OR REPLACE FUNCTION calculate_fraud_score(
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
    ua_match BOOLEAN,
    shared_users INT,
    shared_devices INT
) AS $$
DECLARE
    v_score INT := 100;
    v_flags JSONB := '[]'::JSONB;
    v_ip_shared BOOLEAN := false;
    v_device_shared BOOLEAN := false;
    v_ua_match BOOLEAN := false;
    v_shared_users INT := 0;
    v_shared_devices INT := 0;
    v_ip_count INT;
    v_device_count INT;
BEGIN
    -- Check IP sharing
    SELECT COUNT(DISTINCT user_id) INTO v_ip_count
    FROM video_clicks
    WHERE ip_address = p_ip
    AND user_id != p_user_id;

    IF v_ip_count > 0 THEN
        v_score := v_score - 30;
        v_flags := v_flags || '"IP_SHARED"'::JSONB;
        v_ip_shared := true;
        v_shared_users := v_ip_count;
    END IF;

    -- Check device sharing
    SELECT COUNT(DISTINCT user_id) INTO v_device_count
    FROM affiliate_devices
    WHERE device_fingerprint = p_fingerprint
    AND user_id != p_user_id;

    IF v_device_count > 0 THEN
        v_score := v_score - 40;
        v_flags := v_flags || '"DEVICE_SHARED"'::JSONB;
        v_device_shared := true;
        v_shared_devices := v_device_count;

        -- If 3+ users on same device = automatic fraud
        IF v_device_count >= 2 THEN
            v_score := v_score - 30;
            v_flags := v_flags || '"MULTI_ACCOUNT"'::JSONB;
        END IF;
    END IF;

    -- Return results
    RETURN QUERY SELECT v_score, v_flags, v_ip_shared, v_device_shared, v_ua_match, v_shared_users, v_shared_devices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Apply penalty to user
CREATE OR REPLACE FUNCTION apply_user_penalty(
    p_user_id UUID,
    p_task_submission_id UUID,
    p_penalty_type TEXT,
    p_penalty_percent INT,
    p_reason TEXT,
    p_flags JSONB,
    p_applied_by UUID
)
RETURNS VOID AS $$
DECLARE
    v_current_credit INT;
    v_new_credit INT;
BEGIN
    -- Get current penalty credit
    SELECT penalty_credit INTO v_current_credit
    FROM profiles
    WHERE id = p_user_id;

    IF v_current_credit IS NULL THEN
        v_current_credit := 100;
    END IF;

    -- Calculate new credit
    v_new_credit := GREATEST(0, v_current_credit - p_penalty_percent);

    -- Insert penalty record
    INSERT INTO affiliate_penalties (
        user_id,
        task_submission_id,
        penalty_type,
        penalty_percent,
        reason,
        system_flags,
        applied_by
    ) VALUES (
        p_user_id,
        p_task_submission_id,
        p_penalty_type,
        p_penalty_percent,
        p_reason,
        p_flags,
        p_applied_by
    );

    -- Update profile
    UPDATE profiles
    SET penalty_credit = v_new_credit,
        total_penalties = total_penalties + p_penalty_percent,
        affiliate_status = CASE
            WHEN v_new_credit <= 0 THEN 'banned'
            WHEN v_new_credit < 50 THEN 'suspended'
            ELSE affiliate_status
        END,
        last_fraud_check = NOW()
    WHERE id = p_user_id;

    -- Auto-ban if credit is 0
    IF v_new_credit <= 0 THEN
        UPDATE profiles
        SET affiliate_status = 'banned'
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Register device for user
CREATE OR REPLACE FUNCTION register_user_device(
    p_user_id UUID,
    p_fingerprint TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
RETURNS UUID AS $$
DECLARE
    v_device_id UUID;
    v_existing_id UUID;
BEGIN
    -- Check if device already exists for this user
    SELECT id INTO v_existing_id
    FROM affiliate_devices
    WHERE user_id = p_user_id
    AND device_fingerprint = p_fingerprint;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing device
        UPDATE affiliate_devices
        SET last_seen_at = NOW(),
            usage_count = usage_count + 1,
            ip_address = p_ip,
            user_agent = p_user_agent
        WHERE id = v_existing_id;
        RETURN v_existing_id;
    ELSE
        -- Insert new device
        INSERT INTO affiliate_devices (
            user_id,
            device_fingerprint,
            ip_address,
            user_agent
        ) VALUES (
            p_user_id,
            p_fingerprint,
            p_ip,
            p_user_agent
        )
        RETURNING id INTO v_device_id;
        RETURN v_device_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Register video click
CREATE OR REPLACE FUNCTION register_video_click(
    p_user_id UUID,
    p_task_id UUID,
    p_token TEXT,
    p_ip TEXT,
    p_user_agent TEXT,
    p_from_url TEXT
)
RETURNS UUID AS $$
DECLARE
    v_click_id UUID;
BEGIN
    INSERT INTO video_clicks (
        user_id,
        task_id,
        token,
        ip_address,
        user_agent,
        clicked_from_url
    ) VALUES (
        p_user_id,
        p_task_id,
        p_token,
        p_ip,
        p_user_agent,
        p_from_url
    )
    RETURNING id INTO v_click_id;

    RETURN v_click_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MODULE 8: RLS POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE affiliate_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_task_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for affiliate_devices
CREATE POLICY "Users can view own devices" ON affiliate_devices
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all devices" ON affiliate_devices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Service can manage devices" ON affiliate_devices
    FOR ALL USING (true);

-- Policies for video_clicks
CREATE POLICY "Users can view own clicks" ON video_clicks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all clicks" ON video_clicks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Service can manage clicks" ON video_clicks
    FOR ALL USING (true);

-- Policies for affiliate_penalties
CREATE POLICY "Users can view own penalties" ON affiliate_penalties
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all penalties" ON affiliate_penalties
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can insert penalties" ON affiliate_penalties
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Policies for admin_task_reviews
CREATE POLICY "Admins can manage reviews" ON admin_task_reviews
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- =====================================================
-- MODULE 9: VIEW FOR FRAUD ANALYSIS
-- =====================================================
CREATE OR REPLACE VIEW v_user_fraud_analysis AS
SELECT
    p.id as user_id,
    p.full_name,
    p.email,
    p.penalty_credit,
    p.affiliate_status,
    p.fraud_score,
    p.total_penalties,
    COUNT(DISTINCT ad.id) as device_count,
    COUNT(DISTINCT vc.id) as click_count,
    COUNT(DISTINCT ap.id) as penalty_count,
    MAX(ap.applied_at) as last_penalty_date,
    ARRAY_AGG(DISTINCT ad.device_fingerprint) as fingerprints,
    ARRAY_AGG(DISTINCT vc.ip_address) as ips_used
FROM profiles p
LEFT JOIN affiliate_devices ad ON ad.user_id = p.id
LEFT JOIN video_clicks vc ON vc.user_id = p.id
LEFT JOIN affiliate_penalties ap ON ap.user_id = p.id
WHERE p.is_admin = false
GROUP BY p.id, p.full_name, p.email, p.penalty_credit, p.affiliate_status, p.fraud_score, p.total_penalties;

-- =====================================================
-- VERIFY SETUP
-- =====================================================
SELECT 'Anti-fraud system tables created successfully!' as message;

-- List all new tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('affiliate_devices', 'video_clicks', 'affiliate_penalties', 'admin_task_reviews');

-- Verify new columns in profiles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('penalty_credit', 'affiliate_status', 'total_penalties', 'fraud_score');

-- Verify new columns in task_submissions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'task_submissions'
AND column_name IN ('click_id', 'device_fingerprint', 'client_ip', 'fraud_score', 'fraud_flags', 'ip_shared', 'device_shared');
