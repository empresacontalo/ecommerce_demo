-- ============================================================
-- Portal Gerenciável - Blocos de conteúdo para todas as páginas
-- Garante que TODAS as páginas tenham >= 1 bloco com o conteúdo
-- (classificados por assunto; seções alternam fundo: hero/section/banner).
-- ============================================================

-- ── SALÃO ──
INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'hero', 'Hero Salão', 1,
  '{"badge": "Salão de Beleza", "titulo": "Nossos Serviços", "subtitulo": "Profissionais especializados em colocação e manutenção de cabelos naturais"}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'salao';

INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'servicos', 'Serviços do Salão', 2,
  '{"titulo": "Nossos Serviços", "subtitulo": "Do alongamento à manutenção, cuidamos de você.", "itens": [
     {"titulo": "Colocação de Megahair", "descricao": "Aplicação profissional com técnicas de amarração, micro links ou queratina. Acabamento natural e seguro para os fios.", "preco": "A partir de R$ 200", "duracao": "2-4 horas", "imagem": "/images/hero-3.png", "cta_label": "Agendar pelo Chat", "cta_link": "chat:agendar"},
     {"titulo": "Manutenção Periódica", "descricao": "Retoque das raízes e realinhamento dos fios para manter a naturalidade e evitar danos ao cabelo original.", "preco": "A partir de R$ 150", "duracao": "1-2 horas", "imagem": "/images/hero-1.png", "cta_label": "Agendar pelo Chat", "cta_link": "chat:agendar"},
     {"titulo": "Coloração de Extensões", "descricao": "Coloração especializada para extensões capilares, garantindo uniformidade de tom com seus fios naturais.", "preco": "A partir de R$ 120", "duracao": "1-3 horas", "imagem": "/images/hero-2.png", "cta_label": "Agendar pelo Chat", "cta_link": "chat:agendar"},
     {"titulo": "Corte e Modelagem", "descricao": "Corte personalizado para integrar as extensões de forma natural ao seu estilo pessoal.", "preco": "A partir de R$ 80", "duracao": "30-60 min", "imagem": "/images/product-1.png", "cta_label": "Agendar pelo Chat", "cta_link": "chat:agendar"},
     {"titulo": "Remoção de Extensões", "descricao": "Remoção segura e cuidadosa das extensões, sem danificar os fios naturais.", "preco": "A partir de R$ 100", "duracao": "1-2 horas", "imagem": "/images/product-2.png", "cta_label": "Agendar pelo Chat", "cta_link": "chat:agendar"},
     {"titulo": "Consultoria Capilar", "descricao": "Consultoria personalizada para escolher o tipo, comprimento e cor ideais para o seu visual.", "preco": "Gratuita", "duracao": "30 min", "imagem": "/images/product-3.png", "cta_label": "Agendar pelo Chat", "cta_link": "chat:agendar"}
   ]}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'salao';

INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'cta', 'CTA Agende pelo Chat', 3,
  '{"titulo": "Agende Seu Horário pelo Chat", "subtitulo": "Fale com nossa equipe pelo chat para agendar seu horário. Nossos profissionais estão prontos para transformar seu visual!", "texto_botao": "Agendar pelo Chat", "link_botao": "chat:agendar", "texto_botao2": "Falar no WhatsApp", "link_botao2": "https://wa.me/5513991151970"}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'salao';

-- ── CATÁLOGO (Cabelos e Acessórios) ──
INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'hero', 'Hero Catálogo', 1,
  '{"imagem_fundo": "/images/hero-1.png", "badge": "Coleção Premium", "titulo": "Nossos Cabelos", "subtitulo": "Cabelos 100% naturais selecionados rigorosamente para garantir o brilho, a sedosidade e a durabilidade que você merece."}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'cabelos-e-acessorios';

-- ── PROVADOR VIRTUAL ──
INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'hero', 'Hero Provador Virtual', 1,
  '{"badge": "Provador Virtual", "titulo": "Experimente Antes de Comprar", "subtitulo": "Faça upload da sua foto e veja como ficaria com nossos cabelos naturais — resultado gerado por IA"}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'provador-virtual';

-- ── GALERIA (enriquecimento: hero + seção + CTA com fundos alternados) ──
INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'hero', 'Hero Galeria', 1,
  '{"badge": "Galeria", "titulo": "Nossa Galeria", "subtitulo": "Confira resultados reais de nossas clientes com cabelos naturais."}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'galeria';

UPDATE public.blocos SET ordem = 2 WHERE tipo = 'galeria' AND pagina_id = (SELECT id FROM public.paginas WHERE slug = 'galeria');

INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
SELECT p.id, 'cta', 'CTA Galeria', 3,
  '{"titulo": "Pronta Para Transformar Seu Visual?", "subtitulo": "Explore nosso catálogo de cabelos naturais premium.", "texto_botao": "Ver Catálogo", "link_botao": "/cabelos-e-acessorios", "texto_botao2": "Agendar pelo Chat", "link_botao2": "chat:agendar"}'::jsonb, true
FROM public.paginas p WHERE p.slug = 'galeria';
