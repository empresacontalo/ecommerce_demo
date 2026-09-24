-- ============================================================
-- Tráfego Pago — Google TAGS gerenciáveis pelo admin
-- Data: 2026-09-11
--
-- Tabela única com as tags que serão injetadas entre
-- <head></head> nas páginas públicas selecionadas:
--   ga4            → G-XXXXXXXXXX   (gtag.js + config)
--   google_ads     → AW-XXXXXXXXX   (gtag.js + config)
--   gtm            → GTM-XXXXXXX    (loader do Tag Manager)
--   personalizado  → snippet HTML/JS colado manualmente
--
-- `paginas` guarda os slugs das páginas onde a tag entra;
-- ["todas"] = site inteiro (admin/auth/api nunca recebem tag).
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_tags (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          text NOT NULL,
    tipo          text NOT NULL DEFAULT 'ga4',
    identificador text NOT NULL DEFAULT '',
    codigo        text,
    paginas       text[] NOT NULL DEFAULT ARRAY['todas']::text[],
    ativo         boolean NOT NULL DEFAULT true,
    ordem         integer NOT NULL DEFAULT 0,
    criado_em     timestamptz NOT NULL DEFAULT NOW(),
    atualizado_em timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.google_tags IS 'Tags do Google (GA4, Ads, GTM ou HTML personalizado) injetadas no <head> das páginas públicas selecionadas.';
COMMENT ON COLUMN public.google_tags.tipo IS 'ga4 | google_ads | gtm | personalizado';
COMMENT ON COLUMN public.google_tags.identificador IS 'G-XXXX (GA4), AW-/DC- (Google Ads) ou GTM-XXXX; vazio no tipo personalizado';
COMMENT ON COLUMN public.google_tags.codigo IS 'Snippet HTML/JS completo — usado apenas no tipo personalizado';
COMMENT ON COLUMN public.google_tags.paginas IS 'Slugs das páginas onde a tag entra no <head>; ["todas"] = site inteiro';

CREATE INDEX IF NOT EXISTS idx_google_tags_ativo ON public.google_tags (ativo);

-- Integridade: tipo restrito e identificador único entre tags com ID
-- (evita carregar o mesmo G-/AW-/GTM- duas vezes).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'google_tags_tipo_check') THEN
        ALTER TABLE public.google_tags
            ADD CONSTRAINT google_tags_tipo_check
            CHECK (tipo IN ('ga4', 'google_ads', 'gtm', 'personalizado'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tags_identificador_unico
    ON public.google_tags (upper(identificador))
    WHERE tipo <> 'personalizado' AND identificador <> '';

-- Seed: tag GA4 informada pelo cliente (ativa, todas as páginas).
-- Só insere se ainda não existir a mesma tag.
INSERT INTO public.google_tags (nome, tipo, identificador, paginas, ativo, ordem)
SELECT 'Google Analytics 4', 'ga4', 'G-8KJZC5J14S', ARRAY['todas']::text[], true, 0
WHERE NOT EXISTS (
    SELECT 1 FROM public.google_tags
    WHERE tipo = 'ga4' AND upper(identificador) = 'G-8KJZC5J14S'
);
