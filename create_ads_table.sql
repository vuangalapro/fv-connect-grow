-- Criar tabela de ads (publicidades) se não existir
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar tabela ads
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  details TEXT,
  bank TEXT,
  plan TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  file_data TEXT,
  receipt_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ativar RLS
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para ads
-- Qualquer pessoa pode inserir (formulário público)
DROP POLICY IF EXISTS "ads_insert_public" ON public.ads;
CREATE POLICY "ads_insert_public"
  ON public.ads FOR INSERT
  WITH CHECK (true);

-- Admin pode ver todos
DROP POLICY IF EXISTS "ads_select_admin" ON public.ads;
CREATE POLICY "ads_select_admin"
  ON public.ads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Admin pode atualizar
DROP POLICY IF EXISTS "ads_update_admin" ON public.ads;
CREATE POLICY "ads_update_admin"
  ON public.ads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Admin pode eliminar
DROP POLICY IF EXISTS "ads_delete_admin" ON public.ads;
CREATE POLICY "ads_delete_admin"
  ON public.ads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Verificar tabelas existentes
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
