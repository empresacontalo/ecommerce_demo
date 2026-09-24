-- ============================================================
-- Migração: Colunas faltantes em public.users
-- Data: 2026-08-14
-- Descrição: phone, cpf, reset_token, reset_token_expiry e
--            updated_at não existiam na tabela real (a migration
--            original dependia do Supabase e não foi aplicada
--            integralmente). Adiciona de forma idempotente.
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_token_expiry timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
