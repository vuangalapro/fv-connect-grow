-- Execute no Supabase SQL Editor para corrigir permissões de visualização de withdrawals

-- Remover todas as políticas existentes de withdrawals
DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_update_admin" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_select_admin" ON public.withdrawals;

-- Criar política simples: todos podem ver todos os withdrawals (para debugging)
-- Ou políticas mais restritivas:
-- 1. Utilizador vê apenas os seus
CREATE POLICY "withdrawals_select_own"
  ON public.withdrawals FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Admin vê todos
CREATE POLICY "withdrawals_select_all_for_admin"
  ON public.withdrawals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 3. Todos podem inserir
CREATE POLICY "withdrawals_insert_own"
  ON public.withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Admin pode atualizar
CREATE POLICY "withdrawals_update_admin"
  ON public.withdrawals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );
