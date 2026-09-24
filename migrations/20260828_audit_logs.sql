-- ============================================================
-- Fragrance E-commerce Demo - Migration: audit logs
-- Data: 2026-08-28
-- Registra alterações feitas por administradores e pelo MCP (IA),
-- com texto explicativo por extenso para o dono do site (sem dados
-- sensíveis). Logs expiram automaticamente após 7 dias.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    responsavel_tipo text NOT NULL CHECK (responsavel_tipo IN ('admin', 'mcp')),
    responsavel_nome text NOT NULL,
    acao             text NOT NULL,
    resumo           text NOT NULL,
    detalhe          text NOT NULL,
    criado_em        timestamptz NOT NULL DEFAULT NOW(),
    expira_em        timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_criado_em ON public.audit_logs (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_responsavel_tipo ON public.audit_logs (responsavel_tipo);
CREATE INDEX IF NOT EXISTS idx_audit_logs_responsavel_nome ON public.audit_logs (responsavel_nome);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acao ON public.audit_logs (acao);
CREATE INDEX IF NOT EXISTS idx_audit_logs_expira_em ON public.audit_logs (expira_em);
-- Campos de contexto do dispositivo (versão 2 — solicitado pelo cliente)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS navegador TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS sistema_operacional TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS localizacao TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON public.audit_logs (ip);
