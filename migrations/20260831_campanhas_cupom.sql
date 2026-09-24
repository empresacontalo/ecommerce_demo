-- ============================================================
-- Fragrance E-commerce Demo - Migration: campanhas_cupom
-- Data: 2026-08-31
-- Descrição: Cada campanha passa a ter seu próprio cupom de desconto.
--   - campanhas.cupom_codigo   : código do cupom (nullable; nome gerado por
--     padrão a partir do título quando criado)
--   - campanhas.cupom_escopo   : 'todos' | 'marca' | 'produtos' (default 'todos')
--   - campanhas.cupom_marca    : marca quando escopo = 'marca'
--   - campanhas.cupom_produtos : lista de produtos (ids) quando escopo = 'produtos'
--   O percentual do desconto é o próprio campo `desconto` (ex: "15%").
--   O cupom NÃO é ativado automaticamente: só vale se digitado no carrinho
--   E a campanha ainda estiver ativa (ativo + período). Não é exposto no site.
--   orders.coupon : registra o cupom aplicado no pedido (auditoria).
--   Migra os 3 cupons fixos que estavam hardcoded no código para campanhas reais.
-- Idempotente e re-executável.
-- ============================================================

ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS cupom_codigo   TEXT,
  ADD COLUMN IF NOT EXISTS cupom_escopo   TEXT NOT NULL DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS cupom_marca    TEXT,
  ADD COLUMN IF NOT EXISTS cupom_produtos JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon TEXT;

CREATE INDEX IF NOT EXISTS idx_campanhas_cupom_codigo ON public.campanhas(cupom_codigo);

-- Migração dos cupons fixos que estavam hardcoded no código (BEMVINDA10/FRAN15/ATACADO20)
-- para campanhas reais com cupom, escopo 'todos'. Guarda NOT EXISTS por cupom_codigo
-- deixa a migration idempotente (não duplica se já existirem).
--
-- prioridade = 1000: estas campanhas carregam só o cupom compartilhado pelo
-- atendente (chat/WhatsApp); nunca devem vencer uma campanha real no carrossel
-- público (/api/campanhas/ativas), senão o desconto "seria ativado automaticamente".
INSERT INTO public.campanhas (titulo, descricao, tipo, tipo_campanha, categoria, prioridade, desconto, cupom_codigo, cupom_escopo, ativo, criado_por)
SELECT dados.titulo, dados.descricao, dados.tipo, dados.tipo_campanha, dados.categoria, dados.prioridade, dados.desconto, dados.cupom_codigo, dados.cupom_escopo, dados.ativo, dados.criado_por
FROM (VALUES
  ('Bem-vinda 10%', 'Cupom de desconto de boas-vindas (10%).', 'banner', 'promocional', 'outra', 1000, '10%', 'BEMVINDA10', 'todos', true, NULL::uuid),
  ('Cupom 15%', 'Cupom promocional de desconto (15%).', 'banner', 'promocional', 'outra', 1000, '15%', 'FRAN15', 'todos', true, NULL::uuid),
  ('Atacado 20%', 'Cupom promocional de desconto (20%).', 'banner', 'promocional', 'outra', 1000, '20%', 'ATACADO20', 'todos', true, NULL::uuid)
) AS dados(titulo, descricao, tipo, tipo_campanha, categoria, prioridade, desconto, cupom_codigo, cupom_escopo, ativo, criado_por)
WHERE NOT EXISTS (SELECT 1 FROM public.campanhas c WHERE c.cupom_codigo = dados.cupom_codigo);

-- Ajuste retroativo (caso a migration anterior já tenha rodado pela primeira vez):
-- garante que as campanhas-cupom nunca fiquem à frente de campanhas reais.
UPDATE public.campanhas
SET prioridade = 1000
WHERE cupom_codigo IN ('BEMVINDA10', 'FRAN15', 'ATACADO20')
  AND prioridade <= 900;