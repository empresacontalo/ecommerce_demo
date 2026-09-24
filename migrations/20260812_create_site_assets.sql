-- Tabela de assets do site (favicon, etc.)
CREATE TABLE IF NOT EXISTS public.site_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  dados BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_assets_nome ON public.site_assets (nome);
