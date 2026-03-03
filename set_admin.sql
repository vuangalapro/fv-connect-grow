-- Execute no Supabase SQL Editor para tornar o utilizador admin:
-- https://supabase.com/dashboard/project/ptdcwsdjaznghmpcmtdl/sql/new

-- Atualizar is_admin para true
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'admin@vuangala.tv';
