-- ============================================================
-- Migração: Módulo de Campanhas Promocionais
-- Data: 2026-08-14
-- Descrição: Evolução da tabela campanhas + 6 tabelas novas
--            (imagens, leads, familiares, decorações, histórico,
--            contatos/follow-up). Idempotente.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. Evolução da tabela campanhas
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS tipo_campanha text NOT NULL DEFAULT 'global';
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS prioridade int NOT NULL DEFAULT 0;
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS mensagem_prompt text;
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS canal_padrao text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS follow_up_horas int NOT NULL DEFAULT 24;
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS desconto text;
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS criado_por uuid;

COMMENT ON COLUMN public.campanhas.tipo_campanha IS 'global | pessoal | promocional';
COMMENT ON COLUMN public.campanhas.categoria IS 'dia_das_maes | dia_dos_pais | black_friday | natal | aniversario | casamento | namoro | compromisso | outra';
COMMENT ON COLUMN public.campanhas.prioridade IS 'menor número = maior prioridade';
COMMENT ON COLUMN public.campanhas.canal_padrao IS 'whatsapp | chat | email';

-- ═══════════════════════════════════════════════════════════════
-- 2. campanha_imagens — carrossel multi-imagem
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campanha_imagens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    url text NOT NULL,
    ordem int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'aprovada',
    criada_por_ia boolean NOT NULL DEFAULT false,
    criada_em timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.campanha_imagens.status IS 'aprovada | pendente | rejeitada';
CREATE INDEX IF NOT EXISTS idx_campanha_imagens_campanha ON public.campanha_imagens(campanha_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. campanha_leads — captura do bloco promocional
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campanha_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    nome text NOT NULL,
    whatsapp text,
    email text,
    nascimento date,
    data_especial date,
    preferencia_lembrete text NOT NULL DEFAULT 'mim',
    canal_preferido text NOT NULL DEFAULT 'whatsapp',
    mensagem text,
    status_comunicacao text NOT NULL DEFAULT 'pendente',
    respondeu boolean NOT NULL DEFAULT false,
    respondido_em timestamptz,
    criado_em timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.campanha_leads.preferencia_lembrete IS 'mim | outros | ambos';
COMMENT ON COLUMN public.campanha_leads.status_comunicacao IS 'pendente | enviada | respondida | sem_resposta';
CREATE INDEX IF NOT EXISTS idx_campanha_leads_campanha ON public.campanha_leads(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_leads_status ON public.campanha_leads(status_comunicacao);

-- ═══════════════════════════════════════════════════════════════
-- 4. campanha_familiares — convite de pessoas próximas
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campanha_familiares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.campanha_leads(id) ON DELETE CASCADE,
    nome text NOT NULL,
    whatsapp text,
    data_especial date,
    criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanha_familiares_lead ON public.campanha_familiares(lead_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. campanha_decoracoes — templates decorativos (sem código)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campanha_decoracoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    criado_em timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.campanha_decoracoes.tipo IS 'grinalda | baloes | rosas | coracoes | cupido | tema_maes | tema_pais | tema_black_friday | tema_natal | outro';
CREATE INDEX IF NOT EXISTS idx_campanha_decoracoes_campanha ON public.campanha_decoracoes(campanha_id);

-- ═══════════════════════════════════════════════════════════════
-- 6. campanha_historico — rastreabilidade
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campanha_historico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
    acao text NOT NULL,
    detalhes jsonb,
    criado_por uuid,
    criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanha_historico_campanha ON public.campanha_historico(campanha_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. campanha_contatos — log de comunicações e follow-ups
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.campanha_contatos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.campanha_leads(id) ON DELETE CASCADE,
    canal text NOT NULL,
    tipo text NOT NULL DEFAULT 'inicial',
    mensagem text,
    status text NOT NULL DEFAULT 'enviada',
    resultado text,
    criado_em timestamptz DEFAULT now()
);

COMMENT ON COLUMN public.campanha_contatos.tipo IS 'inicial | followup | manual';
COMMENT ON COLUMN public.campanha_contatos.status IS 'enviada | erro';
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_lead ON public.campanha_contatos(lead_id);
