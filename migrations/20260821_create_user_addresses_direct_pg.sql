-- ============================================================
-- Fragrance E-commerce Demo - Migration: user_addresses on direct Postgres
-- Adaptada de 20260515_create_addresses.sql (que referenciava
-- auth.users do Supabase). Nesta stack as tabelas de auth vivem
-- em public.users e não há schema auth — a tabela nunca havia
-- sido criada aqui (por isso o erro "relation does not exist")
-- com erro de checkout em "Receber no meu endereço".
-- Idempotente. RLS desnecessário: o backend controla acesso.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_addresses (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    user_id            UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

    -- Dados do Endereço
    zip_code           TEXT NOT NULL,
    street             TEXT NOT NULL,
    number             TEXT NOT NULL,
    complement         TEXT,
    neighborhood       TEXT NOT NULL,
    city               TEXT NOT NULL,
    state              TEXT NOT NULL,
    is_default         BOOLEAN DEFAULT false,
    label              TEXT -- Ex: "Casa", "Trabalho"
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);

-- ============================================================
-- Função para garantir apenas um endereço padrão por usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE public.user_addresses
        SET is_default = false
        WHERE user_id = NEW.user_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_default_address ON public.user_addresses;
CREATE TRIGGER set_default_address
    BEFORE INSERT OR UPDATE ON public.user_addresses
    FOR EACH ROW EXECUTE FUNCTION public.handle_default_address();

-- ============================================================
-- Função para limitar em 5 endereços por usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_address_limit()
RETURNS TRIGGER AS $$
DECLARE
    address_count INTEGER;
BEGIN
    SELECT count(*) INTO address_count FROM public.user_addresses WHERE user_id = NEW.user_id;
    IF address_count >= 5 THEN
        RAISE EXCEPTION 'Você já atingiu o limite de 5 endereços cadastrados.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS limit_addresses ON public.user_addresses;
CREATE TRIGGER limit_addresses
    BEFORE INSERT ON public.user_addresses
    FOR EACH ROW EXECUTE FUNCTION public.check_address_limit();