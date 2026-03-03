-- Add is_read column to support_messages table for tracking unread messages
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Update existing messages to be read by default (since they were already seen)
UPDATE support_messages SET is_read = true WHERE is_read IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_support_messages_is_read ON support_messages(is_read);
