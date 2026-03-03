-- =====================================================
-- SUPABASE SQL: Sistema de Tarefas YouTube Anti-Fraude
-- Execute todo este código no Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PARTE 1: Colunas na tabela TASKS
-- =====================================================

-- Adicionar tipo de tarefa (link ou video)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'link' CHECK (task_type IN ('link', 'video'));

-- Tempo mínimo para tarefas de vídeo (em segundos)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS required_time INTEGER DEFAULT 90;

-- ID do vídeo YouTube
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

-- Recompensa da tarefa
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS reward_amount DECIMAL(10,2) DEFAULT 50.00;


-- =====================================================
-- PARTE 2: Colunas na tabela TASK_SUBMISSIONS
-- =====================================================

-- Tempo assistido
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS watched_time INTEGER DEFAULT 0;

-- Código único do comentário
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS unique_comment_code TEXT;

-- Se screenshot foi enviada
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS screenshot_uploaded BOOLEAN DEFAULT false;

-- Quando começou a tarefa
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;

-- Pontuação de risco (0-100)
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- Alerta de fraude
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS fraud_alert TEXT CHECK (fraud_alert IN ('confiavel', 'suspeita', null));

-- Admin que validou
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id);

-- Data de validação
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- Código extraído pelo OCR
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS ocr_extracted_code TEXT;

-- Confiança do OCR
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS ocr_confidence REAL;

-- Fingerprint do dispositivo
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Endereço IP
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Dados de sessão de visualização (para anti-fraude)
ALTER TABLE public.task_submissions 
ADD COLUMN IF NOT EXISTS watch_sessions JSONB;


-- =====================================================
-- PARTE 3: Tabela de Fingerprints
-- =====================================================

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL,
    browser_info TEXT,
    os_info TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    language TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_hash)
);

-- Habilitar RLS
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view own fingerprints" ON public.device_fingerprints;
CREATE POLICY "Users can view own fingerprints" ON public.device_fingerprints
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fingerprints" ON public.device_fingerprints;
CREATE POLICY "Users can insert own fingerprints" ON public.device_fingerprints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all fingerprints" ON public.device_fingerprints;
CREATE POLICY "Admins can view all fingerprints" ON public.device_fingerprints
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );


-- =====================================================
-- PARTE 4: Índices para performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_task_submissions_task_user 
ON public.task_submissions(task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_task_submissions_ip 
ON public.task_submissions(ip_address);

CREATE INDEX IF NOT EXISTS idx_task_submissions_fingerprint 
ON public.task_submissions(device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_task_submissions_fraud_alert 
ON public.task_submissions(fraud_alert);

CREATE INDEX IF NOT EXISTS idx_task_submissions_risk_score 
ON public.task_submissions(risk_score);


-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Verificar colunas criadas
SELECT 'Tarefas' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('task_type', 'required_time', 'youtube_video_id', 'reward_amount')
UNION ALL
SELECT 'Submissões' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_submissions' AND column_name IN ('watched_time', 'unique_comment_code', 'screenshot_uploaded', 'start_time', 'risk_score', 'fraud_alert', 'validated_by', 'validated_at', 'ocr_extracted_code', 'ocr_confidence', 'device_fingerprint', 'ip_address', 'watch_sessions');

SELECT 'Fingerprints' as tabela, 'criada' as status 
FROM information_schema.tables 
WHERE table_name = 'device_fingerprints';
