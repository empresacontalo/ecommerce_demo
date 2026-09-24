-- ============================================================
-- Portal Gerenciável - Migration: create_portal_gerenciavel_schema
-- Criado em: 2026-08-08
-- Descrição: Cria o schema "portal_gerenciavel" para isolar
-- todas as tabelas do site do restante do banco de dados.
-- Como o Supabase é self-hosted com apenas um banco de dados,
-- este schema evita conflitos com outros projetos.
-- ============================================================

-- 1. Criar o schema portal_gerenciavel
CREATE SCHEMA IF NOT EXISTS portal_gerenciavel;

-- 2. Configurar search_path para incluir o schema
--    (o schema public ainda é acessível para auth.users e extensões)
ALTER DATABASE postgres SET search_path TO portal_gerenciavel, public, extensions;

-- ============================================================
-- TABELAS DE CONTEÚDO (CMS)
-- ============================================================

-- Tabela de páginas do site
CREATE TABLE IF NOT EXISTS portal_gerenciavel.paginas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,          -- ex: 'home', 'sobre', 'galeria'
    titulo TEXT NOT NULL,               -- Título da página (SEO)
    meta_description TEXT,              -- Meta description (SEO)
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de blocos de conteúdo (seções de cada página)
CREATE TABLE IF NOT EXISTS portal_gerenciavel.blocos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pagina_id UUID REFERENCES portal_gerenciavel.paginas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                 -- 'hero', 'carrossel', 'cards', 'form', 'cta', 'texto', 'galeria', 'depoimentos', etc.
    titulo TEXT,                        -- Título do bloco (opcional, para identificação no admin)
    ordem INTEGER NOT NULL DEFAULT 0,   -- Ordem de exibição na página
    conteudo JSONB NOT NULL DEFAULT '{}', -- Conteúdo flexível do bloco (textos, links, URLs de imagens, etc.)
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar blocos por página ordenados
CREATE INDEX idx_blocos_pagina_ordem ON portal_gerenciavel.blocos(pagina_id, ordem);

-- Tabela de imagens da galeria
CREATE TABLE IF NOT EXISTS portal_gerenciavel.galeria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    alt TEXT,
    categoria TEXT,                     -- 'salao', 'cabelos', 'clientes', etc.
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de depoimentos
CREATE TABLE IF NOT EXISTS portal_gerenciavel.depoimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    foto_url TEXT,
    estrelas INTEGER DEFAULT 5 CHECK (estrelas >= 1 AND estrelas <= 5),
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de configurações do site (header, footer, cores, etc.)
CREATE TABLE IF NOT EXISTS portal_gerenciavel.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave TEXT NOT NULL UNIQUE,         -- ex: 'header.logo', 'footer.texto', 'whatsapp.numero'
    valor JSONB NOT NULL,               -- Valor flexível
    descricao TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de campanhas e promoções
CREATE TABLE IF NOT EXISTS portal_gerenciavel.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    imagem_url TEXT,
    link_url TEXT,
    tipo TEXT NOT NULL DEFAULT 'banner', -- 'banner', 'popup', 'faixa', 'desconto'
    data_inicio TIMESTAMPTZ,
    data_fim TIMESTAMPTZ,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE portal_gerenciavel.paginas ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_gerenciavel.blocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_gerenciavel.galeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_gerenciavel.depoimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_gerenciavel.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_gerenciavel.campanhas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- Leitura pública para páginas, blocos, galeria, depoimentos, campanhas
CREATE POLICY "Conteudo publico visivel para todos"
    ON portal_gerenciavel.paginas FOR SELECT
    USING (ativo = true);

CREATE POLICY "Blocos publicos visiveis para todos"
    ON portal_gerenciavel.blocos FOR SELECT
    USING (ativo = true);

CREATE POLICY "Galeria publica visivel para todos"
    ON portal_gerenciavel.galeria FOR SELECT
    USING (ativo = true);

CREATE POLICY "Depoimentos publicos visiveis para todos"
    ON portal_gerenciavel.depoimentos FOR SELECT
    USING (ativo = true);

CREATE POLICY "Campanhas publicas visiveis para todos"
    ON portal_gerenciavel.campanhas FOR SELECT
    USING (ativo = true AND (data_inicio IS NULL OR data_inicio <= NOW()) AND (data_fim IS NULL OR data_fim >= NOW()));

-- Configurações: somente admins podem ler (pode conter dados sensíveis)
CREATE POLICY "Configuracoes visiveis apenas para admins"
    ON portal_gerenciavel.configuracoes FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

-- Escrita/Atualização/Deleção: apenas admins aprovados
CREATE POLICY "Admins podem gerenciar paginas"
    ON portal_gerenciavel.paginas FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

CREATE POLICY "Admins podem gerenciar blocos"
    ON portal_gerenciavel.blocos FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

CREATE POLICY "Admins podem gerenciar galeria"
    ON portal_gerenciavel.galeria FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

CREATE POLICY "Admins podem gerenciar depoimentos"
    ON portal_gerenciavel.depoimentos FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

CREATE POLICY "Admins podem gerenciar configuracoes"
    ON portal_gerenciavel.configuracoes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

CREATE POLICY "Admins podem gerenciar campanhas"
    ON portal_gerenciavel.campanhas FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND status = 'approved'));

-- ============================================================
-- TRIGGER PARA updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION portal_gerenciavel.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas
CREATE TRIGGER update_paginas_updated_at
    BEFORE UPDATE ON portal_gerenciavel.paginas
    FOR EACH ROW EXECUTE FUNCTION portal_gerenciavel.update_updated_at_column();

CREATE TRIGGER update_blocos_updated_at
    BEFORE UPDATE ON portal_gerenciavel.blocos
    FOR EACH ROW EXECUTE FUNCTION portal_gerenciavel.update_updated_at_column();

CREATE TRIGGER update_galeria_updated_at
    BEFORE UPDATE ON portal_gerenciavel.galeria
    FOR EACH ROW EXECUTE FUNCTION portal_gerenciavel.update_updated_at_column();

CREATE TRIGGER update_depoimentos_updated_at
    BEFORE UPDATE ON portal_gerenciavel.depoimentos
    FOR EACH ROW EXECUTE FUNCTION portal_gerenciavel.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON portal_gerenciavel.configuracoes
    FOR EACH ROW EXECUTE FUNCTION portal_gerenciavel.update_updated_at_column();

CREATE TRIGGER update_campanhas_updated_at
    BEFORE UPDATE ON portal_gerenciavel.campanhas
    FOR EACH ROW EXECUTE FUNCTION portal_gerenciavel.update_updated_at_column();

-- ============================================================
-- DADOS INICIAIS (SEED)
-- ============================================================

-- Páginas do site (títulos neutros — white-label; o cliente ajusta em /admin)
INSERT INTO portal_gerenciavel.paginas (slug, titulo, meta_description) VALUES
    ('home', 'Início', 'Bem-vindo ao nosso site.'),
    ('sobre', 'Sobre Nós', 'Conheça a nossa história.'),
    ('galeria', 'Galeria', 'Confira nossa galeria de fotos e resultados.'),
    ('fale-conosco', 'Fale Conosco', 'Entre em contato conosco. Atendimento personalizado.'),
    ('cabelos-e-acessorios', 'Cabelos e Acessórios', 'Catálogo de produtos e acessórios.'),
    ('salao', 'Salão de Beleza', 'Conheça nosso salão.'),
    ('provador-virtual', 'Provador Virtual', 'Experimente virtualmente antes de decidir.'),
    ('loja', 'Loja', 'Finalize sua compra.'),
    ('minha-conta', 'Minha Conta', 'Gerencie seus pedidos e dados pessoais.')
ON CONFLICT (slug) DO NOTHING;

-- Configurações iniciais do site (neutras — preenchidas pelo cliente em /admin)
INSERT INTO portal_gerenciavel.configuracoes (chave, valor, descricao) VALUES
    ('header.logo', '{"texto": "Sua Empresa", "subtitulo": ""}', 'Logo e texto do header'),
    ('header.nav_links', '[{"href": "/", "label": "Home"}, {"href": "/sobre", "label": "Sobre"}, {"href": "/cabelos-e-acessorios", "label": "Cabelos"}, {"href": "/salao", "label": "Salão"}, {"href": "/provador-virtual", "label": "Provador"}, {"href": "/galeria", "label": "Galeria"}, {"href": "/fale-conosco", "label": "Contato"}]', 'Links de navegação do header'),
    ('footer.contato.telefone', '{"numero": "", "link": ""}', 'Telefone de contato no rodapé'),
    ('footer.contato.instagram', '{"usuario": "", "link": ""}', 'Instagram no rodapé'),
    ('footer.contato.whatsapp', '{"numero": "", "link": ""}', 'WhatsApp no rodapé'),
    ('footer.endereco', '{"linha1": "", "linha2": "", "cidade": "", "cep": ""}', 'Endereço no rodapé'),
    ('footer.horario', '{"semana": "", "sabado": ""}', 'Horário de funcionamento'),
    ('footer.mapa_url', '{"url": ""}', 'URL do Google Maps'),
    ('footer.facebook', '{"link": ""}', 'Facebook no rodapé'),
    ('whatsapp.numero', '{"numero": "", "link": ""}', 'Número do WhatsApp para o botão flutuante')
ON CONFLICT (chave) DO NOTHING;
