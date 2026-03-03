-- Adicionar campo de expiração à tabela tasks (se não existir)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours');

-- Atualizar tarefas existentes para ter 24h de duração
UPDATE public.tasks SET expires_at = created_at + interval '24 hours' WHERE expires_at IS NULL;

-- Criar função para limpar tarefas expiradas
CREATE OR REPLACE FUNCTION public.clean_expired_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.tasks WHERE expires_at < now();
END;
$$;

-- Nota: Para ativar a limpeza automática, você precisa configurar um cron job no Supabase
-- Ou pode usar a extensão_cron:
 pg-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- GRANT USAGE ON SCHEMA cron TO postgres;
-- SELECT cron.schedule('cleanup-expired-tasks', '0 * * * *', 'SELECT public.clean_expired_tasks();');
-- Este cron job executa a cada hora para limpar tarefas expiradas
