-- Políticas RLS para a tabela tasks
-- Execute este SQL no Supabase SQL Editor

-- Verificar se a tabela tasks existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'tasks'
);

-- Criar políticas para admin fazer tudo na tabela tasks
-- INSERT - admin pode inserir
DROP POLICY IF EXISTS "tasks_insert_admin" ON public.tasks;
CREATE POLICY "tasks_insert_admin"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- UPDATE - admin pode atualizar
DROP POLICY IF EXISTS "tasks_update_admin" ON public.tasks;
CREATE POLICY "tasks_update_admin"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- DELETE - admin pode excluir
DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;
CREATE POLICY "tasks_delete_admin"
  ON public.tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- SELECT - admin e utilizadores autenticados podem ver
DROP POLICY IF EXISTS "tasks_select_authenticated" ON public.tasks;
CREATE POLICY "tasks_select_authenticated"
  ON public.tasks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Verificar se as políticas foram criadas
SELECT policyname, tablename, cmd 
FROM pg_policies 
WHERE tablename = 'tasks';
