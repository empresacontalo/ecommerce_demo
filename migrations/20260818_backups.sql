-- ============================================================
-- Portal Gerenciável - Backups do conteúdo do site
-- ============================================================

CREATE TABLE IF NOT EXISTS public.backups (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          text NOT NULL,
    criado_por    text,
    tamanho_bytes bigint NOT NULL DEFAULT 0,
    payload       jsonb NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_created ON public.backups (created_at DESC);
