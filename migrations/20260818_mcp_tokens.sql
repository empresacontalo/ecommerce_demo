-- ============================================================
-- Portal Gerenciável - Tokens MCP
-- Gerencia tokens de acesso da IA ao painel (/api/mcp).
-- O token é armazenado apenas como hash sha256 (nunca em texto).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mcp_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        text NOT NULL,
    token_hash  text NOT NULL UNIQUE,
    token_enc   text,
    ultimos4    text,
    created_at  timestamptz NOT NULL DEFAULT NOW(),
    expires_at  timestamptz,
    blocked     boolean NOT NULL DEFAULT false,
    last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON public.mcp_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_expires ON public.mcp_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.mcp_audit (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    acao       text NOT NULL,
    detalhes   jsonb,
    criado_por text,
    created_at timestamptz NOT NULL DEFAULT NOW()
);
