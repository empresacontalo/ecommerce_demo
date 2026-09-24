-- ============================================================
-- Fragrance E-commerce Demo - Migration: desconto_por_pagamento
-- Data: 2026-09-01
-- Descrição: Desconto por forma de pagamento (PIX / Cartão / Boleto).
--   - produtos.descontos  (jsonb): % específico do produto por forma.
--     Ex: {"pix": 8, "credit": 3, "boleto": 0} → PIX 8%, Crédito 3%.
--     Regra: quando o produto define e o Desconto Geral também define a
--     mesma forma, vale o MAIOR dos dois.
--   - configuracoes 'descontos.pagamento' (jsonb): Desconto Geral aplicado a
--     todos os produtos por forma. Ex: {"pix":5,"credit":0,"boleto":0}.
--     Editável no Admin > Produtos > Descontos Gerais (sem deploy).
--   Desconto é calculado no servidor no checkout (incide no valor cobrado
--   no QRCode/boleto/cartão no Asaas) — nunca hardcoded como "5%" antigamente.
-- Idempotente.
-- ============================================================

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS descontos JSONB;

INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES (
  'descontos.pagamento',
  '{"pix":5,"credit":0,"boleto":0}'::jsonb,
  'Desconto geral por forma de pagamento em % (PIX, cartão, boleto). O desconto específico do produto, se maior, vence.'
)
ON CONFLICT (chave) DO NOTHING;