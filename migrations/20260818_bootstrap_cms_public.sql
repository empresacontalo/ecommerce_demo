-- ============================================================
-- Fragrance E-commerce Demo - Migration: bootstrap CMS tables in public
-- Data: 2026-08-18
-- Motivo: as migrations originais (20260808_*) criam as tabelas de
-- conteúdo no schema "portal_gerenciavel", mas a aplicação consulta
-- SEMPRE "public.<tabela>" (ver src/app/actions/cms.ts, api/cms/*,
-- api/produtos/*). No banco em produção tudo vive em "public".
-- Este bootstrap replica o DDL real da produção (130% fiel) para que
-- um banco novo da stack ecommerce_demo suba idêntico ao que o código espera.
-- Idempotente e re-executável: CREATE TABLE IF NOT EXISTS + constraints
-- protegidas por DO blocks (re-deploy nunca quebra).
-- ============================================================

-- ------------------------------------------------------------------
-- ROLE "authenticated" (pseudo-role do Supabase usado pelas policies
-- de RLS de leads e produtos). No Postgres standalone não existe por
-- padrão; criamos NOLOGIN apenas para as policies funcionarem.
-- O banco em produção tem este mesmo role (pg_roles: authenticated).
-- ------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END $$;

-- ------------------------------------------------------------------
-- PÁGINAS (CMS)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paginas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    slug text NOT NULL,
    titulo text NOT NULL,
    meta_description text,
    ativo boolean DEFAULT true
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.paginas'::regclass AND conname = 'paginas_pkey') THEN
        ALTER TABLE public.paginas ADD CONSTRAINT paginas_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.paginas'::regclass AND conname = 'paginas_slug_key') THEN
        ALTER TABLE public.paginas ADD CONSTRAINT paginas_slug_key UNIQUE (slug);
    END IF;
END $$;

-- ------------------------------------------------------------------
-- BLOCOS DE CONTEÚDO (CMS)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pagina_id uuid,
    tipo text DEFAULT 'hero'::text NOT NULL,
    titulo text,
    ordem integer DEFAULT 0,
    conteudo jsonb DEFAULT '{}'::jsonb,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.blocos'::regclass AND conname = 'blocos_pkey') THEN
        ALTER TABLE public.blocos ADD CONSTRAINT blocos_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.blocos'::regclass AND conname = 'blocos_pagina_id_fkey') THEN
        ALTER TABLE public.blocos ADD CONSTRAINT blocos_pagina_id_fkey
            FOREIGN KEY (pagina_id) REFERENCES public.paginas(id) ON DELETE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_blocos_pagina_ordem ON public.blocos(pagina_id, ordem);

-- ------------------------------------------------------------------
-- GALERIA (CMS)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.galeria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    alt text,
    categoria text,
    ordem integer DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.galeria'::regclass AND conname = 'galeria_pkey') THEN
        ALTER TABLE public.galeria ADD CONSTRAINT galeria_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- ------------------------------------------------------------------
-- DEPOIMENTOS (CMS)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.depoimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    texto text NOT NULL,
    foto_url text,
    estrelas integer DEFAULT 5,
    ordem integer DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.depoimentos'::regclass AND conname = 'depoimentos_pkey') THEN
        ALTER TABLE public.depoimentos ADD CONSTRAINT depoimentos_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- ------------------------------------------------------------------
-- CONFIGURAÇÕES (CMS)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chave text NOT NULL,
    valor jsonb DEFAULT '{}'::jsonb NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.configuracoes'::regclass AND conname = 'configuracoes_pkey') THEN
        ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.configuracoes'::regclass AND conname = 'configuracoes_chave_key') THEN
        ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_chave_key UNIQUE (chave);
    END IF;
END $$;

-- ------------------------------------------------------------------
-- CAMPANHAS (módulo de campanhas)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campanhas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    imagem_url text,
    link_url text,
    tipo text DEFAULT 'banner'::text,
    data_inicio timestamp with time zone,
    data_fim timestamp with time zone,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tipo_campanha text DEFAULT 'global'::text NOT NULL,
    categoria text,
    prioridade integer DEFAULT 0 NOT NULL,
    mensagem_prompt text,
    canal_padrao text DEFAULT 'whatsapp'::text NOT NULL,
    follow_up_horas integer DEFAULT 24 NOT NULL,
    desconto text,
    criado_por uuid
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.campanhas'::regclass AND conname = 'campanhas_pkey') THEN
        ALTER TABLE public.campanhas ADD CONSTRAINT campanhas_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- ------------------------------------------------------------------
-- LEADS (captura pública; RLS: leitura/edição admin, inserção anônima)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    instagram text,
    facebook text,
    source text DEFAULT 'Direto'::text,
    status text DEFAULT 'Novo'::text,
    score integer DEFAULT 0,
    tags text[],
    last_contact timestamp with time zone
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.leads'::regclass AND conname = 'leads_pkey') THEN
        ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
    END IF;
END $$;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura/Edição apenas para Admin" ON public.leads;
CREATE POLICY "Leitura/Edição apenas para Admin" ON public.leads TO authenticated USING (true);
DROP POLICY IF EXISTS "Permitir inserção anônima de leads" ON public.leads;
CREATE POLICY "Permitir inserção anônima de leads" ON public.leads FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------------
-- AGENDAMENTOS (RLS ativo)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    client_name text NOT NULL,
    client_phone text NOT NULL,
    service text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'Pendente'::text,
    notes text,
    price numeric(10,2)
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agendamentos'::regclass AND conname = 'agendamentos_pkey') THEN
        ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);
    END IF;
END $$;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
