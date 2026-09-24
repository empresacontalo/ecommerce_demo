-- ============================================================
-- Fragrance E-commerce Demo - Migration: order tracking and status management
-- Data: 2026-08-22
-- 1. Adiciona coluna de código de rastreamento dos Correios
-- 2. Normaliza status legados para o novo fluxo:
--    PENDING -> RECEBIDO | PAGO/PAID -> APROVADO
--    CANCELED -> CANCELADO | REFUNDED -> DEVOLUCAO | ENTREGUE -> ENVIADO
-- Idempotente.
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;

UPDATE public.orders SET status = 'RECEBIDO'    WHERE status = 'PENDING';
UPDATE public.orders SET status = 'APROVADO'    WHERE status IN ('PAGO', 'PAID');
UPDATE public.orders SET status = 'CANCELADO'   WHERE status IN ('CANCELED');
UPDATE public.orders SET status = 'DEVOLUCAO'   WHERE status IN ('REFUNDED');
UPDATE public.orders SET status = 'ENVIADO'     WHERE status IN ('ENTREGUE');