-- ============================================================
-- Fragrance E-commerce Demo - Migration: MCP token scopes
-- Data: 2026-08-28
-- Tipos de chave:
--   'admin'  (padrão p/ tokens existentes) — consulta + venda + alterar qualquer dado
--   'vendas' — apenas consultas de informação e realização de vendas
-- Idempotente.
-- ============================================================

ALTER TABLE public.mcp_tokens ADD COLUMN IF NOT EXISTS escopo TEXT NOT NULL DEFAULT 'admin';

UPDATE public.mcp_tokens SET escopo = 'admin' WHERE escopo IS NULL OR escopo = '';