-- ============================================================
-- Fragrance E-commerce Demo - Migration: frete_motoboy_config
-- Data: 2026-08-31
-- Descrição: Seed da configuração `frete.motoboy` — municípios e taxa (R$)
-- de entrega por motoboy no checkout. Editável no Admin > Configurações.
-- Fora desta lista, a opção de motoboy não é exibida. Se a config for
-- removida/apagada, o sistema usa a tabela padrão do código
-- (Praia Grande 15 / São Vicente 25 / Santos 35). Idempotente.
-- ============================================================

INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES (
  'frete.motoboy',
  '[{"cidade":"Praia Grande","valor":15},{"cidade":"São Vicente","valor":25},{"cidade":"Santos","valor":35}]'::jsonb,
  'Entrega por motoboy: municípios e taxa (R$) por cidade. Sem a cidade na lista, o motoboy fica indisponível.'
)
ON CONFLICT (chave) DO NOTHING;