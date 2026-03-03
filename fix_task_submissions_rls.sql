-- Políticas RLS para task_submissions - permitir admin atualizar e inserir
-- Execute este SQL no Supabase SQL Editor

-- =====================================================
-- TASK SUBMISSIONS POLICIES
-- =====================================================

-- Política para admin fazer UPDATE em qualquer submission
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

-- Política para admin fazer INSERT (criar novas submissions em nome de utilizadores)
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

-- Política para admin fazer DELETE
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

-- =====================================================
-- PROFILES POLICIES - Allow admin to update any profile
-- =====================================================

-- Policy for admin to UPDATE any profile (for adding balance)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Verificar se as políticas foram criadas
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('task_submissions', 'profiles');
