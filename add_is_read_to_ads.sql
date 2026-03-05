-- Add is_read column to ads table
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ads_is_read ON public.ads(is_read);

-- Update all existing ads to be read (they were already seen)
UPDATE public.ads SET is_read = true WHERE is_read IS NULL;
