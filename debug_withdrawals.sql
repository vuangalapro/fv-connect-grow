-- Desativar RLS temporariamente para testes
ALTER TABLE public.withdrawals DISABLE ROW LEVEL SECURITY;

-- Verificar se agora consegue ver os dados
-- SELECT * FROM public.withdrawals WHERE status = 'pending';
