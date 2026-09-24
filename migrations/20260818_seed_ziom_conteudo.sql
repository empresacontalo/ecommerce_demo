-- ============================================================
-- Fragrance E-commerce Demo - Seed: Brand Content, Configurations, CMS Blocks & SEO
-- Fictional Brand: Aura Fragrance Co. (New York, NY)
-- 100% English Localization | Idempotent
-- ============================================================

-- ------------------------------------------------------------------
-- 1. BRAND CONFIGURATIONS
-- ------------------------------------------------------------------
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('header.logo',
   '{"texto": "Aura Fragrance Co.", "subtitulo": "Luxury & Niche Perfumery"}',
   'Header logo branding and typography'),

  ('header.logo_imagem', '""',
   'Image logo URL (empty = render text logo)'),

  ('header.nav_links',
   '[{"href": "/", "label": "Home"}, {"href": "/sobre", "label": "About"},
     {"href": "/cabelos-e-acessorios", "label": "Catalog"},
     {"href": "/provador-virtual", "label": "Scent Finder"},
     {"href": "/galeria", "label": "Gallery"},
     {"href": "/fale-conosco", "label": "Contact"}]',
   'Primary navigation links in header'),

  ('seo.home',
   '{"title": "Aura Fragrance Co. — Luxury & Niche Perfumery | Official Boutique",
     "description": "Discover exceptional luxury and niche fragrances: Lattafa, French Avenue, Al Wataniah, Orientica and more. Signature Eau de Parfum with legendary sillage and fast delivery."}',
   'Homepage SEO meta'),

  ('seo.catalogo',
   '{"title": "Luxury Fragrance Catalog — Aura Fragrance Co.",
     "description": "Explore our curated portfolio of authentic luxury perfumes. High concentration EDP, rare woody accords, and radiant floral scents."}',
   'Catalog SEO meta'),

  ('seo.provador',
   '{"title": "Interactive Scent Finder — Aura Fragrance Co.",
     "description": "Find your signature luxury fragrance through our curated olfactory recommendation engine."}',
   'Virtual Scent Finder SEO meta'),

  ('footer.endereco',
   '{"linha1": "742 Fifth Avenue, Suite 1200",
     "linha2": "Midtown Manhattan",
     "cidade": "New York, NY",
     "cep": "10022"}',
   'Store address in footer'),

  ('footer.horario',
   '{"semana": "Mon–Fri: 9:00 AM – 8:00 PM EST", "sabado": "Sat: 10:00 AM – 6:00 PM EST"}',
   'Concierge business hours'),

  ('footer.contato.instagram',
   '{"usuario": "@aurafragrance.demo", "link": "https://instagram.com/aurafragrance.demo"}',
   'Social media instagram profile'),

  ('footer.contato.telefone',
   '{"numero": "+1 (212) 555-0198", "link": "tel:+12125550198"}',
   'Support phone in footer'),

  ('footer.contato.whatsapp',
   '{"numero": "+1 (212) 555-0198", "link": "https://wa.me/12125550198"}',
   'WhatsApp / Messaging link in footer'),

  ('footer.descricao',
   '"Curators of world-renowned luxury fragrances and rare oriental elixirs. Engineered for exceptional longevity, depth, and timeless distinction."',
   'Short brand overview in footer'),

  ('whatsapp.numero',
   '{"numero": "+1 (212) 555-0198", "link": "https://wa.me/12125550198"}',
   'Support contact number'),

  ('whatsapp.mensagem',
   '"Hello! I am browsing the Aura Fragrance Co. boutique and would love fragrance guidance."',
   'Default support inquiry message'),

  ('empresa.email', '"concierge@aurafragrances.demo"',
   'Official support email address'),

  ('empresa.facebook', '{"link": "https://facebook.com/aurafragrancedemo", "usuario": "/aurafragrancedemo"}',
   'Social media facebook profile')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, updated_at = NOW();

-- Color Palettes: Dark Premium Luxury & Warm Light Mode
INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('tema.ativo', '"dark"',
   'Active theme (dark|light)'),
  ('tema.paleta',
   '{"dark": {"primary": "#F2CA50", "primary-light": "#FFE088", "primary-dark": "#D4AF37", "primary-hover": "#FFE088", "primary-rgb": "242, 202, 80", "secondary": "#C9C6C5", "secondary-light": "#E5E2E1", "secondary-dark": "#99907C", "gold": "#F2CA50", "gold-light": "#FFE088", "gold-dark": "#D4AF37", "dark": "#16130B", "dark-soft": "#1F1B13", "light": "#EAE1D4", "light-warm": "#FFF4B2", "surface": "#16130B", "surface-alt": "#231F17", "text": "#EAE1D4", "text-secondary": "#D0C5AF", "text-tertiary": "#99907C", "text-inverse": "#16130B", "text-accent": "#F2CA50", "border": "#4D4635", "border-light": "#38342B", "border-hover": "#F2CA50", "success": "#1D9E75", "warning": "#F2C200", "error": "#FF8A80", "info": "#5B8DEF"},
     "light": {"primary": "#C9A227", "primary-light": "#E0B93A", "primary-dark": "#9A7B18", "primary-hover": "#E8C973", "primary-rgb": "201, 162, 39", "secondary": "#8A6A2E", "secondary-light": "#A98E52", "secondary-dark": "#5C451C", "gold": "#C9A227", "gold-light": "#E0B93A", "gold-dark": "#9A7B18", "dark": "#F8F4E8", "dark-soft": "#FFFFFF", "light": "#3A2E18", "light-warm": "#4A3A1C", "surface": "#FFFFFF", "surface-alt": "#F5EFE3", "text": "#3A2E18", "text-secondary": "#6E4E1D", "text-tertiary": "#8A6A2E", "text-inverse": "#050303", "text-accent": "#6E4E1D", "border": "#E2D5B8", "border-light": "#EADFC8", "border-hover": "#C9A227", "success": "#1D9E75", "warning": "#B8860B", "error": "#B3261E", "info": "#3B6FD4"}}'::jsonb,
   'Design system color tokens')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, updated_at = NOW();

-- ------------------------------------------------------------------
-- 2. PAGES
-- ------------------------------------------------------------------
INSERT INTO public.paginas (slug, titulo, meta_description, ativo) VALUES
  ('home', 'Home', 'Aura Fragrance Co. — Luxury & Niche Perfumery', true),
  ('sobre', 'About Us', 'Discover the heritage and artisan philosophy of Aura Fragrance Co.', true),
  ('cabelos-e-acessorios', 'Catalog', 'Curated luxury fragrance catalog with doorstep delivery', true),
  ('provador-virtual', 'Scent Finder', 'Discover your ideal signature fragrance', true),
  ('galeria', 'Gallery', 'Aura Fragrance Co. portfolio showcase', true),
  ('fale-conosco', 'Contact Us', 'Inquiries and personal fragrance concierge', true),
  ('salao', 'Salon', 'Inactive legacy view', false)
ON CONFLICT (slug) DO UPDATE SET titulo = EXCLUDED.titulo, meta_description = EXCLUDED.meta_description, ativo = EXCLUDED.ativo;

-- ------------------------------------------------------------------
-- 3. HOMEPAGE BLOCKS
-- ------------------------------------------------------------------
DO $$
DECLARE
  home_id UUID;
BEGIN
  SELECT id INTO home_id FROM public.paginas WHERE slug = 'home';
  DELETE FROM public.blocos WHERE pagina_id = home_id;

  -- Block 1: Hero Carousel (8 luxury fragrance slides)
  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (home_id, 'carrossel', 'Hero Principal', 1, '{
    "slides": [
      {
        "imagem": "/images/carrossel/slide-01-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-01-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-01-retrato.jpg",
        "badge": "✨ New Arrival",
        "titulo": "The Icons of Elegance",
        "subtitulo": "Asad and Yara — the beloved masterpieces of modern perfumery, renowned for unrivaled longevity.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-02-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-02-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-02-retrato.jpg",
        "badge": "✨ Haute Parfumerie",
        "titulo": "Scent That Defines Your Narrative",
        "subtitulo": "Rare oriental elixirs engineered with intense concentration and radiant sillage.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-03-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-03-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-03-retrato.jpg",
        "badge": "✨ Bestseller",
        "titulo": "Fakhar — Pride in Craftsmanship",
        "subtitulo": "A pinnacle of sophistication featuring rich woods, fresh spices, and aristocratic charm.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-04-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-04-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-04-retrato.jpg",
        "badge": "✨ Exclusive Reserve",
        "titulo": "Opulence in Every Single Drop",
        "subtitulo": "Precious compositions that elevate presence into unforgettable memory.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-05-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-05-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-05-retrato.jpg",
        "badge": "🔥 Niche Selection",
        "titulo": "Your Olfactory Signature Begins Here",
        "subtitulo": "Smoky oud, velvet amber, and sensual musk — celebrate the art of genuine perfumery.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-06-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-06-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-06-retrato.jpg",
        "badge": "🔥 Niche Selection",
        "titulo": "Fragrances That Command Respect",
        "subtitulo": "Imported boutique editions with personalized recommendations tailored to your style.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-07-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-07-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-07-retrato.jpg",
        "badge": "🔥 Niche Selection",
        "titulo": "Timeless Sillage & Lasting Impression",
        "subtitulo": "Authentic luxury houses including Lattafa, French Avenue, Al Wataniah, and Orientica.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      },
      {
        "imagem": "/images/carrossel/slide-08-paisagem.jpg",
        "imagem_paisagem": "/images/carrossel/slide-08-paisagem.jpg",
        "imagem_retrato": "/images/carrossel/slide-08-retrato.jpg",
        "badge": "🔥 Niche Selection",
        "titulo": "Oud For Glory — Legendary Presence",
        "subtitulo": "Mesmerizing smoky woods crowned with spicy nutmeg and royal saffron.",
        "cta1_label": "Explore Catalog",
        "cta1_link": "/cabelos-e-acessorios",
        "cta2_label": "Scent Concierge",
        "cta2_link": "chat:atendimento"
      }
    ]
  }'::jsonb);

  -- Block 2: Brand Pillars (4 cards)
  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (home_id, 'diferenciais', 'Diferenciais', 2, '{
    "titulo": "Why Choose Aura Fragrance Co.?",
    "items": [
      {"icone": "🌙", "titulo": "100% Authentic Imports", "descricao": "Direct partnerships with verified houses guaranteeing batch purity, sealed presentation, and uncompromised oil concentrations."},
      {"icone": "🤝", "titulo": "Tailored Scent Consultations", "descricao": "Our fragrance specialists guide you through scent families, notes, and occasions to find your ideal match."},
      {"icone": "🚚", "titulo": "Express Doorstep Delivery", "descricao": "Fast, secure, temperature-controlled dispatch ensuring your bottles arrive in pristine condition."},
      {"icone": "🎁", "titulo": "Signature Luxury Packaging", "descricao": "Every order arrives enclosed in our custom black-and-gold presentation box, ideal for gifting or collecting."}
    ]
  }'::jsonb);

  -- Block 3: Featured Products
  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (home_id, 'produtos', 'Featured Products', 3, '{
    "titulo": "Featured Fragrances",
    "subtitulo": "Our most coveted niche editions and iconic releases.",
    "max_produtos": 8
  }'::jsonb);

  -- Block 4: Short Brand Story
  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (home_id, 'texto', 'About Aura', 4, '{
    "conteudo_html": "<h2>Crafting Memories Through Scent</h2><p>Aura Fragrance Co. was founded on Fifth Avenue with an unwavering devotion to the world’s finest olfactory arts. We believe a fine fragrance is not merely an accessory, but an intimate personal signature that evokes memory and inspires confidence.</p><p style=\"margin-top:0.75rem\"><a class=\"btn btn-gold\" href=\"/sobre\">Discover Our Heritage</a></p>"
  }'::jsonb);

  -- Block 5: Final CTA
  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (home_id, 'cta', 'CTA Final', 5, '{
    "titulo": "Ready to Discover Your Signature Scent?",
    "subtitulo": "Explore our curated collection of luxury perfumes or speak with our concierge team today.",
    "texto_botao": "Shop Full Catalog",
    "link_botao": "/cabelos-e-acessorios",
    "texto_botao2": "Live Scent Chat",
    "link_botao2": "chat:atendimento"
  }'::jsonb);
END $$;

-- ------------------------------------------------------------------
-- 4. ABOUT US BLOCKS
-- ------------------------------------------------------------------
DO $$
DECLARE
  sobre_id UUID;
BEGIN
  SELECT id INTO sobre_id FROM public.paginas WHERE slug = 'sobre';
  DELETE FROM public.blocos WHERE pagina_id = sobre_id;

  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (sobre_id, 'hero', 'Banner Sobre', 1, '{
    "badge": "Our Heritage",
    "titulo": "Aura Fragrance Co. <span>Timeless Craft & Modern Elegance</span>",
    "subtitulo": "Dedicated to bringing exceptional luxury perfumery to fragrance connoisseurs worldwide."
  }'::jsonb);

  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (sobre_id, 'texto', 'Nossa História', 2, '{
    "html": "<h2>Our Journey</h2><p>Born from a deep passion for olfactory artistry, <strong>Aura Fragrance Co.</strong> curates the most distinguished fragrances from legendary perfume capitals. Every bottle in our vault is selected for its complexity, balance, and extraordinary longevity.</p><blockquote>\"A signature fragrance is invisible, yet it leaves the most enduring memory.\" — Master Perfumer</blockquote><p>Our philosophy combines rare natural essences—from precious agarwood (oud) and ambergris to damask rose and velvet cedar—with modern refinement, offering an unparalleled sensory voyage.</p>"
  }'::jsonb);

  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (sobre_id, 'diferenciais', 'Nossos Valores', 3, '{
    "titulo": "Our Guiding Values",
    "items": [
      {"icone": "👃", "titulo": "Perfume as Art", "descricao": "We view each formulation as a work of art designed to harmonize with your skin and lifestyle."},
      {"icone": "🤝", "titulo": "Personalized Guidance", "descricao": "Attentive consultations ensuring you find the scent that elevates your presence."},
      {"icone": "✅", "titulo": "Purity & Provenance", "descricao": "Guaranteed authentic batches sourced directly from licensed global ateliers."},
      {"icone": "💖", "titulo": "Dedicated Excellence", "descricao": "Committed to delivering luxury in every package, interaction, and delivery."}
    ]
  }'::jsonb);
END $$;

-- ------------------------------------------------------------------
-- 5. CONTACT US BLOCKS
-- ------------------------------------------------------------------
DO $$
DECLARE
  contato_id UUID;
BEGIN
  SELECT id INTO contato_id FROM public.paginas WHERE slug = 'fale-conosco';
  DELETE FROM public.blocos WHERE pagina_id = contato_id;

  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (contato_id, 'hero', 'Banner Contato', 1, '{
    "badge": "Contact Us",
    "titulo": "Connect with Our <span>Fragrance Concierge</span>",
    "subtitulo": "Our specialists are available for bespoke scent recommendations and order assistance."
  }'::jsonb);

  INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo) VALUES
  (contato_id, 'form', 'Formulário de Contato', 2, '{
    "tipo": "contato",
    "titulo": "Send Us an Inquiry",
    "campos": ["nome", "email", "telefone", "assunto", "mensagem"],
    "botao_label": "Send Message"
  }'::jsonb);
END $$;
