-- Adicionar coluna de resposta às mensagens de suporte
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna reply para a resposta do admin
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS reply TEXT;

-- Adicionar coluna replied_at para a data da resposta
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Verificar a estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'support_messages';
