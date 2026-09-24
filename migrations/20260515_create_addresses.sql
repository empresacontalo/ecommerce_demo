-- ============================================================
-- Fragrance E-commerce Demo - Migration: create_user_addresses
-- Criado em: 2026-05-15
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_addresses (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
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

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own addresses"
    ON public.user_addresses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses"
    ON public.user_addresses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses"
    ON public.user_addresses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses"
    ON public.user_addresses FOR DELETE
    USING (auth.uid() = user_id);

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

CREATE TRIGGER limit_addresses
    BEFORE INSERT ON public.user_addresses
    FOR EACH ROW EXECUTE FUNCTION public.check_address_limit();

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);
