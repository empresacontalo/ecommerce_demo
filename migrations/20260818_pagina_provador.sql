-- ============================================================
-- Portal Gerenciável - Página Provador Virtual no CMS
-- Garante que TODAS as páginas do site existam em public.paginas
-- para aparecerem em Admin > Conteúdo (com opção exibir/ocultar).
-- ============================================================

INSERT INTO public.paginas (slug, titulo, meta_description, ativo)
VALUES ('provador-virtual', 'Provador Virtual', 'Experimente cabelos virtualmente antes de decidir.', true)
ON CONFLICT (slug) DO NOTHING;
