-- Add affiliate_read column to support_messages table for tracking read replies

ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS affiliate_read BOOLEAN DEFAULT false;

-- Update existing messages where there's a reply to be read by default
UPDATE support_messages SET affiliate_read = true WHERE reply IS NOT NULL AND affiliate_read IS NULL;
