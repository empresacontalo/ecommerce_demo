-- Adiciona link de acompanhamento do entregador aos pedidos (além do código dos Correios)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_link text;