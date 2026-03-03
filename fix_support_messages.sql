-- Criar tabela de mensagens de suporte com suporte para utilizadores não autenticados
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar tabela de mensagens de suporte (se não existir)
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- 3. Políticas para support_messages - qualquer pessoa pode inserir (formulário público)
DROP POLICY IF EXISTS "support_messages_insert_public" ON public.support_messages;
CREATE POLICY "support_messages_insert_public"
  ON public.support_messages FOR INSERT
  WITH CHECK (true);

-- Utilizador pode ver as suas próprias mensagens
DROP POLICY IF EXISTS "support_messages_select_own" ON public.support_messages;
CREATE POLICY "support_messages_select_own"
  ON public.support_messages FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Admin pode ver todas as mensagens
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

-- Admin pode atualizar mensagens
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

-- Admin pode eliminar mensagens
DROP POLICY IF EXISTS "support_messages_delete_admin" ON public.support_messages;
CREATE POLICY "support_messages_delete_admin"
  ON public.support_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Verificar se a tabela foi criada
SELECT * FROM public.support_messages LIMIT 0;
