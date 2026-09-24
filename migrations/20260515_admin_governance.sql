-- Tabela para gerenciar administradores e seus status
CREATE TYPE admin_status AS ENUM ('pending', 'approved', 'blocked');

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    status admin_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- 1. Qualquer usuário autenticado pode ver seu próprio status
CREATE POLICY "Users can view own admin status" 
ON public.admin_users FOR SELECT 
USING (auth.uid() = id);

-- 2. Apenas administradores APROVADOS podem ver todos os outros
CREATE POLICY "Approved admins can view all admin users" 
ON public.admin_users FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = auth.uid() AND status = 'approved'
    )
);

-- 3. Apenas administradores APROVADOS podem atualizar status (aprovar/bloquear)
CREATE POLICY "Approved admins can update admin status" 
ON public.admin_users FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = auth.uid() AND status = 'approved'
    )
);

-- 4. Apenas administradores APROVADOS podem deletar outros
CREATE POLICY "Approved admins can delete admin users" 
ON public.admin_users FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = auth.uid() AND status = 'approved'
    )
);

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- Gatilho para criar registro em admin_users após registro no Auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.raw_user_meta_data->>'is_admin_request')::boolean = true THEN
        INSERT INTO public.admin_users (id, email, full_name, status)
        VALUES (
            NEW.id,
            NEW.email,
            NEW.raw_user_meta_data->>'full_name',
            'pending'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created_admin
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_admin_user();

