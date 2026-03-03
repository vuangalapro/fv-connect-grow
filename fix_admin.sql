-- Execute este SQL no Supabase SQL Editor para tornar o utilizador admin:
-- https://supabase.com/dashboard/project/ptdcwsdjaznghmpcmtdl/sql/new

-- Atualizar is_admin para true
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'admin@vuangala.tv';

-- Se não encontrou, verificar se o perfil existe
SELECT * FROM public.profiles WHERE email = 'admin@vuangala.tv';
