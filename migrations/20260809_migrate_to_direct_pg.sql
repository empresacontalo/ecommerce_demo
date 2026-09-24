-- ============================================================
-- Migração: Supabase → PostgreSQL Direto
-- Data: 2026-08-09
-- Descrição: Substitui a dependência do auth.users do Supabase
--            por uma tabela public.users gerenciada pela aplicação.
--            Remove RLS e triggers vinculados ao Supabase Auth.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. Criar tabela public.users (substitui auth.users)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    phone TEXT,
    cpf TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    reset_token TEXT,
    reset_token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Migrar dados existentes de auth.users → public.users
--    (apenas se auth.users existir e tiver dados)
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO public.users (id, email, full_name, phone, cpf, created_at, updated_at)
        SELECT
            u.id,
            u.email,
            u.raw_user_meta_data->>'full_name',
            u.raw_user_meta_data->>'phone',
            u.raw_user_meta_data->>'cpf',
            u.created_at,
            u.updated_at
        FROM auth.users u
        WHERE NOT EXISTS (
            SELECT 1 FROM public.users pu WHERE pu.id = u.id
        );

        RAISE NOTICE 'Migrados % usuários de auth.users para public.users', (SELECT COUNT(*) FROM auth.users);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Remover triggers que dependem de auth.users
-- ═══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_admin_user();

-- ═══════════════════════════════════════════════════════════════
-- 4. Remover políticas RLS que usam auth.uid()
-- ═══════════════════════════════════════════════════════════════

-- admin_users RLS policies
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Approved admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Approved admins can update admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Approved admins can delete admin users" ON public.admin_users;

-- orders RLS policies
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;

-- user_addresses RLS policies
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can insert their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.user_addresses;

-- Desabilitar RLS nas tabelas (não precisamos de RLS por usuário no backend)
-- O controle de acesso será feito pela aplicação
ALTER TABLE IF EXISTS public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_addresses DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 5. Atualizar foreign keys para referenciar public.users
-- ═══════════════════════════════════════════════════════════════

-- admin_users
ALTER TABLE public.admin_users
    DROP CONSTRAINT IF EXISTS admin_users_id_fkey;
ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_id_fkey
    FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

-- orders
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- user_addresses
ALTER TABLE public.user_addresses
    DROP CONSTRAINT IF EXISTS user_addresses_user_id_fkey;
ALTER TABLE public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 6. Atualizar função is_admin (remover dependência de auth.uid())
-- ═══════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.is_admin(UUID);
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = user_id AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ═══════════════════════════════════════════════════════════════
-- 7. Índices para public.users
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);

-- ═══════════════════════════════════════════════════════════════
-- 8. Trigger updated_at para public.users
-- ═══════════════════════════════════════════════════════════════
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
