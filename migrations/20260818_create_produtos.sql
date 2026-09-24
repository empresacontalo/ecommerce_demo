-- ============================================================
-- Fragrance E-commerce Demo - Migration: create_produtos
-- Data: 2026-08-18
-- Descrição: Cria a tabela public.produtos replicando o schema real
-- usado pelo portal-gerenciavel (origem do white-label), incluindo
-- RLS com leitura pública e edição apenas para admin autenticado.
-- Idempotente e re-executável.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.produtos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    description  TEXT,
    price        NUMERIC(10,2) NOT NULL,
    category     TEXT,
    stock_status TEXT DEFAULT 'Em estoque',
    images       TEXT[],
    origin       TEXT,
    type         TEXT,
    length       TEXT,
    badge        TEXT,
    price_old    NUMERIC(10,2),
    stock        INTEGER NOT NULL DEFAULT 10
);

CREATE INDEX IF NOT EXISTS idx_produtos_slug ON public.produtos(slug);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura p\u00fablica de produtos" ON public.produtos;
CREATE POLICY "Leitura p\u00fablica de produtos"
    ON public.produtos FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Edi\u00e7\u00e3o de produtos apenas para Admin" ON public.produtos;
CREATE POLICY "Edi\u00e7\u00e3o de produtos apenas para Admin"
    ON public.produtos FOR ALL
    USING (true);
