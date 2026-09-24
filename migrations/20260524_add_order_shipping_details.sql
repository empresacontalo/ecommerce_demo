-- ============================================================
-- Fragrance E-commerce Demo - Migration: add_order_shipping_details
-- Criado em: 2026-05-24
-- ============================================================

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'pac',
ADD COLUMN IF NOT EXISTS shipping_address JSONB;
