-- ============================================================
-- Kanban automatizado de leads (funil de compra) — 2026-09-01
--
-- 1) orders.lead_id: liga o pedido ao lead do kanban (permite o
--    webhook do Asaas mover o lead de fase quando o pagamento
--    é confirmado).
-- 2) leads.etapa_atualizada_em: quando o lead entrou na fase
--    atual — usado pelo agente de IA para medir o tempo sem
--    conclusão (abandono de carrinho).
-- 3) Índice por status para leitura rápida do kanban.
-- ============================================================

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS etapa_atualizada_em timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);