-- Adicionar coluna is_read para mensagens não lidas
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna is_read
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Verificar a estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'support_messages';
