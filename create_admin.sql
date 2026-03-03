-- Script para atualizar utilizador para admin
-- Execute isto no Supabase SQL Editor se o utilizador já existir

-- Atualizar is_admin para o email específico
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'admin@vuangala.tv';

-- Se não existir perfil, inserir
INSERT INTO public.profiles (id, email, full_name, is_admin, balance)
SELECT 
  auth.users.id,
  auth.users.email,
  auth.users.raw_user_meta_data->>'full_name',
  true,
  0
FROM auth.users
WHERE auth.users.email = 'admin@vuangala.tv'
ON CONFLICT (id) DO UPDATE SET is_admin = true;
