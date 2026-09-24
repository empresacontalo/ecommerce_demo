-- 1. Cria a função auxiliar com SECURITY DEFINER para verificar se o usuário é admin aprovado, contornando RLS.
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = user_id AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Remove as políticas RLS recursivas atuais.
DROP POLICY IF EXISTS "Approved admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Approved admins can update admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Approved admins can delete admin users" ON public.admin_users;

-- 3. Recria as políticas RLS usando a nova função auxiliar.
CREATE POLICY "Approved admins can view all admin users" 
ON public.admin_users FOR SELECT 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Approved admins can update admin status" 
ON public.admin_users FOR UPDATE 
USING (public.is_admin(auth.uid()));

CREATE POLICY "Approved admins can delete admin users" 
ON public.admin_users FOR DELETE 
USING (public.is_admin(auth.uid()));
