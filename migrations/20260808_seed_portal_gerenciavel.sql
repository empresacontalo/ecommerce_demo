-- ============================================================
-- Portal Gerenciável - Seed Data
-- Criado em: 2026-08-08
-- Insere blocos de exemplo baseados no conteúdo atual do site.
-- Todos os blocos podem ser editados, reordenados ou excluídos
-- pelo painel administrativo.
-- ============================================================

-- ============================================================
-- PÁGINA HOME
-- ============================================================

DO $$
DECLARE
    home_id UUID;
BEGIN
    SELECT id INTO home_id FROM portal_gerenciavel.paginas WHERE slug = 'home';

    -- Bloco 1: Hero Carrossel
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'carrossel', 'Hero Principal', 1, '{
        "slides": [
            {
                "imagem": "/images/hero-1.png",
                "badge": "✨ Qualidade Premium",
                "titulo": "Transforme Seu Visual com <span>Cabelos Naturais</span>",
                "subtitulo": "Cabelos Brasileiro, Vietnamita e Indiano. Qualidade certificada, atacado e varejo.",
                "cta1_label": "Ver Catálogo",
                "cta1_href": "/cabelos-e-acessorios",
                "cta2_label": "Agendar Horário",
                "cta2_href": "chat:agendar"
            },
            {
                "imagem": "/images/hero-2.png",
                "badge": "💎 Coleção Premium",
                "titulo": "Cabelos 100% Naturais de <span>Origem Certificada</span>",
                "subtitulo": "Brasileiro, Vietnamita e Indiano — selecionados com rigor para garantir a máxima qualidade.",
                "cta1_label": "Ver Catálogo",
                "cta1_href": "/cabelos-e-acessorios",
                "cta2_label": "Fale Conosco",
                "cta2_href": "/fale-conosco"
            },
            {
                "imagem": "/images/hero-3.png",
                "badge": "🏆 Atendimento Premium",
                "titulo": "Salão Especializado em <span>Colocação de Cabelos</span>",
                "subtitulo": "Equipe profissional para colocação e manutenção. Resultado impecável.",
                "cta1_label": "Agendar Horário",
                "cta1_href": "chat:agendar",
                "cta2_label": "Conhecer Salão",
                "cta2_href": "/salao"
            }
        ]
    }'::jsonb);

    -- Bloco 2: Formulário de Captura de Lead
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'form', 'Captura de Lead', 2, '{
        "tipo": "lead",
        "titulo": "Receba Ofertas Exclusivas",
        "subtitulo": "Cadastre-se e receba novidades, lançamentos e promoções em primeira mão.",
        "campos": ["nome", "email", "telefone"],
        "botao_label": "Quero Receber Ofertas"
    }'::jsonb);

    -- Bloco 3: Diferenciais
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'diferenciais', 'Diferenciais', 3, '{
        "titulo": "Por que escolher a Fran Hair?",
        "items": [
            {"icone": "🌟", "titulo": "Cabelos 100% Naturais", "descricao": "Origem certificada. Brasileiro, Vietnamita e Indiano com qualidade premium."},
            {"icone": "✂️", "titulo": "Colocação Profissional", "descricao": "Equipe especializada em alongamento e manutenção de cabelos naturais."},
            {"icone": "🚚", "titulo": "Entrega Rápida", "descricao": "Envio para todo o Brasil com segurança e rastreamento."},
            {"icone": "💳", "titulo": "Pagamento Facilitado", "descricao": "Parcele em até 12x no cartão ou pague via PIX com desconto."}
        ]
    }'::jsonb);

    -- Bloco 4: Produtos em Destaque (vitrine dinâmica)
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'produtos', 'Produtos em Destaque', 4, '{
        "titulo": "Produtos em Destaque",
        "subtitulo": "Nossa seleção especial de cabelos naturais e acessórios.",
        "limite": 8
    }'::jsonb);

    -- Bloco 5: Serviços do Salão
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'servicos', 'Serviços do Salão', 5, '{
        "titulo": "Nossos Serviços",
        "subtitulo": "Do alongamento à manutenção, cuidamos de você.",
        "items": [
            {"icone": "💇", "titulo": "Colocação de Megahair", "descricao": "Aplicação profissional de alongamento capilar com cabelos naturais."},
            {"icone": "🔄", "titulo": "Manutenção de Alongamento", "descricao": "Serviço completo de manutenção e realinhamento do megahair."},
            {"icone": "🎨", "titulo": "Coloração e Tratamento", "descricao": "Técnicas avançadas de coloração e tratamentos capilares."},
            {"icone": "📸", "titulo": "Provador Virtual", "descricao": "Experimente diferentes cabelos virtualmente antes de decidir."}
        ]
    }'::jsonb);

    -- Bloco 6: Depoimentos
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'depoimentos', 'Depoimentos', 6, '{
        "titulo": "O que nossas clientes dizem",
        "subtitulo": "Confira a experiência de quem já transformou o visual."
    }'::jsonb);

    -- Bloco 7: CTA Final
    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (home_id, 'cta', 'CTA Final', 7, '{
        "titulo": "Pronta Para Transformar Seu Visual?",
        "texto": "Agende uma visita ao nosso salão ou explore nosso catálogo de cabelos naturais premium.",
        "botao_primary_label": "Explorar Catálogo",
        "botao_primary_href": "/cabelos-e-acessorios",
        "botao_secondary_label": "Agendar Horário",
        "botao_secondary_href": "chat:agendar",
        "estilo": "dark"
    }'::jsonb);
END $$;

-- ============================================================
-- PÁGINA SOBRE
-- ============================================================

DO $$
DECLARE
    sobre_id UUID;
BEGIN
    SELECT id INTO sobre_id FROM portal_gerenciavel.paginas WHERE slug = 'sobre';

    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (sobre_id, 'hero', 'Banner Sobre', 1, '{
        "imagem": "/images/sobre-hero.png",
        "badge": "Our Heritage",
        "titulo": "Discover <span>Aura Fragrance Co.</span>",
        "subtitulo": "Tradition and distinction in luxury fragrances."
    }'::jsonb);

    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (sobre_id, 'texto', 'Our Story', 2, '{
        "html": "<h2>Our Story</h2><p>Aura Fragrance Co. was born from a passion for rare olfactory art, bringing the world''s finest luxury fragrances directly to connoisseurs.</p><p>Located in New York, NY, we offer an exquisite selection with worldwide dispatch.</p>"
    }'::jsonb);

    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (sobre_id, 'diferenciais', 'Nossos Valores', 3, '{
        "titulo": "Nossos Valores",
        "items": [
            {"icone": "✅", "titulo": "Qualidade", "descricao": "Selecionamos apenas os melhores cabelos naturais com origem certificada."},
            {"icone": "🤝", "titulo": "Confiança", "descricao": "Relacionamento transparente e duradouro com nossas clientes."},
            {"icone": "💖", "titulo": "Dedicação", "descricao": "Atendimento personalizado para cada necessidade."}
        ]
    }'::jsonb);
END $$;

-- ============================================================
-- PÁGINA FALE CONOSCO
-- ============================================================

DO $$
DECLARE
    contato_id UUID;
BEGIN
    SELECT id INTO contato_id FROM portal_gerenciavel.paginas WHERE slug = 'fale-conosco';

    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (contato_id, 'hero', 'Banner Contato', 1, '{
        "imagem": "/images/contato-hero.png",
        "badge": "Fale Conosco",
        "titulo": "Entre em <span>Contato</span>",
        "subtitulo": "Estamos prontos para atender você. Respondemos em até 24h."
    }'::jsonb);

    INSERT INTO portal_gerenciavel.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
    (contato_id, 'form', 'Formulário de Contato', 2, '{
        "tipo": "contato",
        "titulo": "Envie sua Mensagem",
        "campos": ["nome", "email", "telefone", "assunto", "mensagem"],
        "botao_label": "Enviar Mensagem"
    }'::jsonb);
END $$;

-- ============================================================
-- DEPOIMENTOS DE EXEMPLO
-- ============================================================

INSERT INTO portal_gerenciavel.depoimentos (nome, texto, estrelas, ordem) VALUES
    ('Maria Silva', 'Cabelos maravilhosos! A qualidade é excepcional e o atendimento foi impecável. Super recomendo!', 5, 1),
    ('Ana Paula', 'Comprei cabelo Vietnamita e estou encantada com o resultado. Não desbota e é super fácil de cuidar.', 5, 2),
    ('Juliana Costa', 'O provador virtual me ajudou muito a escolher o cabelo certo. A experiência de compra foi incrível!', 5, 3),
    ('Carla Mendes', 'Faço manutenção do meu megahair no salão há 6 meses. Equipe profissional e resultados incríveis.', 5, 4),
    ('Patrícia Oliveira', 'Atendimento nota 10! Tirei todas as minhas dúvidas antes de comprar. Entrega super rápida.', 5, 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GALERIA DE EXEMPLO
-- ============================================================

INSERT INTO portal_gerenciavel.galeria (url, alt, categoria, ordem) VALUES
    ('/images/galeria-1.jpg', 'Cabelo natural instalado - resultado final', 'resultados', 1),
    ('/images/galeria-2.jpg', 'Salão Fran Hair - ambiente', 'salao', 2),
    ('/images/galeria-3.jpg', 'Cabelo Vietnamita premium', 'cabelos', 3),
    ('/images/galeria-4.jpg', 'Resultado de alongamento', 'resultados', 4),
    ('/images/galeria-5.jpg', 'Cabelo Indiano natural', 'cabelos', 5),
    ('/images/galeria-6.jpg', 'Cliente satisfeita com megahair', 'resultados', 6)
ON CONFLICT DO NOTHING;
