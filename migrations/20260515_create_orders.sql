-- ============================================================
-- Fragrance E-commerce Demo - Migration: create_orders_table
-- Criado em: 2026-05-15
-- ============================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

    -- Cliente (guest ou autenticado)
    user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name      TEXT NOT NULL,
    customer_email     TEXT NOT NULL,
    customer_cpf       TEXT NOT NULL,
    customer_phone     TEXT NOT NULL,

    -- Itens do pedido (snapshot do carrinho)
    items              JSONB NOT NULL,

    -- Valores
    subtotal           NUMERIC(10, 2) NOT NULL,
    discount           NUMERIC(10, 2) NOT NULL DEFAULT 0,
    shipping           NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_price        NUMERIC(10, 2) NOT NULL,

    -- Pagamento
    payment_method     TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit', 'boleto')),
    status             TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED')),
    asaas_payment_id   TEXT UNIQUE,
    asaas_invoice_url  TEXT,
    pix_qr_code        TEXT

);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados veem apenas seus próprios pedidos
CREATE POLICY "orders_select_own" ON public.orders
    FOR SELECT
    USING (auth.uid() = user_id);

-- O backend (Service Role) tem acesso total (ignora RLS)
-- Não é necessária policy — Service Role bypassa RLS por padrão.

-- ============================================================
-- Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id          ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment_id ON public.orders(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at       ON public.orders(created_at DESC);
