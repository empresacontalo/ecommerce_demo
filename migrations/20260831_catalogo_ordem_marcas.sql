-- ============================================================
-- Fragrance E-commerce Demo - Migration: catalogo_ordem_marcas
-- Data: 2026-08-31
-- Descrição: Configura a ordem de exibição das marcas no catálogo,
-- vitrines da home e filtro. Padrão: Lattafa primeira, demais A–Z.
-- A ordem é editável no Admin em Produtos > "Ordem de Exibição das Marcas".
-- Idempotente: não sobrescreve uma ordem já salva pelo admin.
-- ============================================================

INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES (
  'catalogo.ordem_marcas',
  '["Lattafa","Afnan","Al Wataniah","Ard Al Zaafaran","Armaf","French Avenue","Lab8","Maison Alhambra","Mawwal Arabia","Orientica","Riiffs","Zakat"]'::jsonb,
  'Ordem de exibição das marcas no catálogo e vitrines (Lattafa primeiro por padrão)'
)
ON CONFLICT (chave) DO NOTHING;