-- Execute no Supabase SQL Editor para permitir admin ver todos os saques e submissions:
-- https://supabase.com/dashboard/project/ptdcwsdjaznghmpcmtdl/sql/new

-- Políticas RLS para withdrawals - permitir admin ver todos
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

-- Políticas RLS para task_submissions - permitir admin ver todos
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
