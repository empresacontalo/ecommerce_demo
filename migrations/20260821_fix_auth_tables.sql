-- ============================================================
-- Fix: tabelas de autenticação ausentes no banco do ecommerce_demo
-- Data: 2026-08-21
-- Motivo: o schema de auth (users/admin_users/orders) das
-- migrations do portal-gerenciavel nunca foi aplicado aqui;
-- o Google SSO falhava com "relation public.users does not exist".
-- Estrutura espelhada da stack portal-gerenciavel (referência).
-- Idempotente.
-- ============================================================

-- 1. public.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    full_name TEXT,
    google_id TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    phone TEXT,
    cpf TEXT,
    reset_token TEXT,
    reset_token_expiry TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);

CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_users_updated_at();

-- 2. public.admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_id_fkey') THEN
        ALTER TABLE public.admin_users
            ADD CONSTRAINT admin_users_id_fkey
            FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = user_id AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. public.orders (dashboard admin consulta esta tabela)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_cpf TEXT,
    customer_phone TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    shipping NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_price NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'pix',
    status TEXT NOT NULL DEFAULT 'PENDING',
    shipping_method TEXT DEFAULT 'pac',
    shipping_address JSONB,
    asaas_payment_id TEXT,
    asaas_invoice_url TEXT,
    pix_qr_code TEXT,
    boleto_url TEXT,
    boleto_linha_digitavel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Pre-approved Administrator (admin@example.com / password)
INSERT INTO public.users (email, password_hash, full_name, role)
VALUES ('admin@example.com', '$2b$10$B935PtoRJOf5ibL0vTGJZOkKXPL/l.dmkp3RaI/aVuv1c1zTAMkdC', 'Administrator', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name;

INSERT INTO public.admin_users (id, email, full_name, status)
SELECT id, email, 'Administrator', 'approved'
FROM public.users WHERE email = 'admin@example.com'
ON CONFLICT (id) DO UPDATE SET status = 'approved', email = EXCLUDED.email, full_name = EXCLUDED.full_name;