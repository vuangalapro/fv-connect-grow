-- Criar função para eliminar utilizador completamente (profile + auth)
-- Execute no Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Eliminar dados relacionados primeiro
  DELETE FROM public.support_messages WHERE user_id = target_user_id;
  DELETE FROM public.withdrawals WHERE user_id = target_user_id;
  DELETE FROM public.task_submissions WHERE user_id = target_user_id;
  DELETE FROM public.opened_tasks WHERE user_id = target_user_id;
  
  -- 2. Eliminar o perfil
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- 3. Eliminar do Auth (o trigger handle_deletes_user deve fazer isto automaticamente)
  -- Se não houver trigger, pode eliminar manualmente se tiver permissões
  DELETE FROM auth.users WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$;
