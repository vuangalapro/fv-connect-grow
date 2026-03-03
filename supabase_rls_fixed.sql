-- Script SQL mínimo para adicionar suporte e funções atómicas
-- Execute este SQL no seu painel Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ptdcwsdjaznghmpcmtdl/sql/new

-- =====================================================
-- INSTRUÇÕES PARA CRIAR ADMIN
-- =====================================================
-- O admin DEVE ser criado no painel Supabase:
-- 1. Vá para: https://supabase.com/dashboard/project/ptdcwsdjaznghmpcmtdl/auth/users
-- 2. Clique "Add user"
-- 3. Email: admin@vuangala.tv
-- 4. Password: root2026 (ou outra)
-- 5. Marque "Email confirmada" se quiser login imediato
-- 6. Após criar, o perfil será criado automaticamente
--
-- Se o utilizador já existe mas não tem is_admin=true, execute:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'admin@vuangala.tv';

-- 1. Criar tabela de mensagens de suporte (se não existir)
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ativar RLS na tabela de suporte
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para support_messages
DROP POLICY IF EXISTS "support_messages_insert_own" ON public.support_messages;
CREATE POLICY "support_messages_insert_own"
  ON public.support_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_messages_select_own" ON public.support_messages;
CREATE POLICY "support_messages_select_own"
  ON public.support_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_messages_select_admin" ON public.support_messages;
CREATE POLICY "support_messages_select_admin"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "support_messages_update_admin" ON public.support_messages;
CREATE POLICY "support_messages_update_admin"
  ON public.support_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 4. Função RPC para dedução atómica de saldo (evita race conditions)
CREATE OR REPLACE FUNCTION public.atomic_balance_deduct(
  target_user_id UUID,
  amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT balance INTO current_balance
  FROM public.profiles
  WHERE id = target_user_id
  FOR UPDATE;

  IF current_balance < amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET balance = balance - amount, updated_at = now()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- 5. Função RPC para adição atómica de saldo
CREATE OR REPLACE FUNCTION public.atomic_balance_add(
  target_user_id UUID,
  amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER AS $
BEGIN
  UPDATE public.profiles
  SET balance = balance + amount, updated_at = now()
  WHERE id = target_user_id;
  RETURN TRUE;
END;
$;

-- 6. Políticas RLS para withdrawals - permitir admin ver todos
DROP POLICY IF EXISTS "withdrawals_select_admin" ON public.withdrawals;
CREATE POLICY "withdrawals_select_admin"
  ON public.withdrawals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 7. Políticas RLS para task_submissions - permitir admin ver todos
DROP POLICY IF EXISTS "task_submissions_select_admin" ON public.task_submissions;
CREATE POLICY "task_submissions_select_admin"
  ON public.task_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
    OR auth.uid() = user_id
  );

-- 8. Políticas RLS para task_submissions - permitir admin atualizar
DROP POLICY IF EXISTS "task_submissions_update_admin" ON public.task_submissions;
CREATE POLICY "task_submissions_update_admin"
  ON public.task_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 9. Políticas RLS para task_submissions - permitir admin inserir
DROP POLICY IF EXISTS "task_submissions_insert_admin" ON public.task_submissions;
CREATE POLICY "task_submissions_insert_admin"
  ON public.task_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
    OR auth.uid() = user_id
  );

-- 10. Políticas RLS para task_submissions - permitir admin eliminar
DROP POLICY IF EXISTS "task_submissions_delete_admin" ON public.task_submissions;
CREATE POLICY "task_submissions_delete_admin"
  ON public.task_submissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );
