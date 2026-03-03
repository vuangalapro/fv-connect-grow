-- Add policy to allow affiliates to mark their own messages as read
-- This allows updating the affiliate_read column

DROP POLICY IF EXISTS "support_messages_update_own" ON public.support_messages;
CREATE POLICY "support_messages_update_own"
  ON public.support_messages FOR UPDATE
  USING (auth.uid() = user_id);
