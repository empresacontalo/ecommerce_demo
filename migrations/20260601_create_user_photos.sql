-- Migration: Tabela para persistir foto do usuário no Provador Virtual
-- Apenas uma foto por usuário (UPSERT pattern)

CREATE TABLE IF NOT EXISTS public.user_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    photo_base64 TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_photos_user ON public.user_photos(user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_photos_updated_at
    BEFORE UPDATE ON public.user_photos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
