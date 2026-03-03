-- =====================================================
-- RULE ACCEPTANCE TABLE FOR AFFILIATES
-- =====================================================
-- Execute this SQL in Supabase SQL Editor
-- =====================================================

-- Table to track affiliate rule acceptance
CREATE TABLE IF NOT EXISTS affiliate_rule_acceptance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    rule_version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_rule_acceptance_affiliate 
ON affiliate_rule_acceptance(affiliate_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_rule_acceptance_date 
ON affiliate_rule_acceptance(accepted_at DESC);

-- Enable RLS
ALTER TABLE affiliate_rule_acceptance ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own acceptance records
CREATE POLICY "Users can view own rule acceptance" 
ON affiliate_rule_acceptance
FOR SELECT USING (affiliate_id = auth.uid());

-- Policy: Users can insert their own acceptance
CREATE POLICY "Users can insert rule acceptance" 
ON affiliate_rule_acceptance
FOR INSERT WITH CHECK (affiliate_id = auth.uid());

-- Policy: Admins can view all
CREATE POLICY "Admins can view all rule acceptance" 
ON affiliate_rule_acceptance
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Function to check if rules need to be re-accepted
-- Returns true if acceptance is needed (first login, >7 days, or new version)
CREATE OR REPLACE FUNCTION check_rules_acceptance_needed(p_affiliate_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_acceptance TIMESTAMPTZ;
    v_current_version TEXT := '1.0';
    v_accepted_version TEXT;
BEGIN
    -- Get last acceptance
    SELECT accepted_at, rule_version INTO v_last_acceptance, v_accepted_version
    FROM affiliate_rule_acceptance
    WHERE affiliate_id = p_affiliate_id
    ORDER BY accepted_at DESC
    LIMIT 1;

    -- No acceptance record = needs to accept
    IF v_last_acceptance IS NULL THEN
        RETURN true;
    END IF;

    -- Check if > 7 days since last acceptance
    IF NOW() - v_last_acceptance > INTERVAL '7 days' THEN
        RETURN true;
    END IF;

    -- Check if rules version changed
    IF v_accepted_version != v_current_version THEN
        RETURN true;
    END IF;

    -- All checks passed, no need to accept
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record rule acceptance
CREATE OR REPLACE FUNCTION record_rule_acceptance(
    p_affiliate_id UUID,
    p_ip_address TEXT,
    p_user_agent TEXT
)
RETURNS UUID AS $$
DECLARE
    v_acceptance_id UUID;
BEGIN
    INSERT INTO affiliate_rule_acceptance (
        affiliate_id,
        accepted_at,
        ip_address,
        user_agent,
        rule_version
    ) VALUES (
        p_affiliate_id,
        NOW(),
        p_ip_address,
        p_user_agent,
        '1.0'
    )
    RETURNING id INTO v_acceptance_id;

    RETURN v_acceptance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify table created
SELECT 'Rule acceptance table created successfully!' as message;

-- Show table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'affiliate_rule_acceptance';
