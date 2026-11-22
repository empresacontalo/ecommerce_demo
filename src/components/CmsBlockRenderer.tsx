'use client';

import { useState, useEffect, useRef, createContext, useContext } from 'react';
import Image from 'next/image';
import ProductCard from '@/components/ProductCard';
import { registerLead } from '@/app/actions/leads';
import { getConfigs, resolveTokens } from '@/utils/empresa';
import { useCampanhaAtiva, campanhaParaSlides, CampanhaCtx, CAMPANHA_VAZIA } from '@/components/campanhas/campanha-context';
import type { CampanhaAtivaData } from '@/components/campanhas/campanha-context';
import type { CmsBloco } from '@/app/actions/cms';
import CtaButton from '@/components/CtaButton';

/* ── Contexto de tokens: substitui {{token}} pelos Dados da Empresa ── */
const TokenCtx = createContext<(s?: string | null) => string | null | undefined>(s => s || undefined);
function useTokens() {
  return useContext(TokenCtx);
}

/* ── Helper: renderiza texto com HTML sem escapar ── */
function Titulo({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  if (children.includes('<')) {
    return <span dangerouslySetInnerHTML={{ __html: children }} />;
  }
  return <>{children}</>;
}

/* ── Tipos de conteúdo por bloco ── */
interface SlideContent { imagem: string; imagem_paisagem?: string; imagem_retrato?: string; badge?: string; titulo?: string; subtitulo?: string; cta1_label?: string; cta1_link?: string; cta2_label?: string; cta2_link?: string; ativo?: boolean; }
interface CardContent { icone?: string; titulo: string; descricao: string; link?: string; }
interface ServicoContent { titulo: string; descricao: string; preco?: string; duracao?: string; imagem?: string; cta_label?: string; cta_link?: string; }
interface DepoimentoContent { nome: string; texto: string; estrelas?: number; papel?: string; avatar_url?: string; }
interface GaleriaItemContent { url: string; categoria: string; titulo: string; alt?: string; ativo?: boolean; }
interface DiferencialContent { icone?: string; titulo: string; descricao: string; }
interface ProdutoVitrine { id: string; slug: string; name: string; price: number | string | null; origin?: string | null; category?: string | null; images?: string[] | null; image_url?: string | null; }

/* ── Hero Block ── */
function HeroBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const c = bloco.conteudo || {};
  /* Variante simples (about-hero) para páginas internas — sem imagem de fundo */
  if (!c.imagem_fundo) {
    return (
      <section className="section about-hero">
        <div className="container">
          {(resolve(c.badge)) && <span className="badge badge-gold" style={{ marginBottom:'var(--spacing-md)' }}>{resolve(c.badge)}</span>}
          {c.titulo && <h1><Titulo>{resolve(c.titulo)}</Titulo></h1>}
          {c.subtitulo && <p>{resolve(c.subtitulo)}</p>}
          <span className="gold-line" />
        </div>
      </section>
    );
  }
  /* Variante com imagem de fundo (página home) */
  return (
    <section className="hero" style={{ backgroundImage: `url(${c.imagem_fundo})` }}>
      <div className="hero-overlay" />
      <div className="container hero-content">
        {(resolve(c.badge)) && <span className="hero-badge">{resolve(c.badge)}</span>}
        {c.titulo && <h1 className="hero-title"><Titulo>{resolve(c.titulo)}</Titulo></h1>}
        {c.subtitulo && <p className="hero-subtitle">{resolve(c.subtitulo)}</p>}
        {(c.cta_texto || c.cta2_texto) && (
          <div className="hero-cta-group">
            {c.cta_texto && <CtaButton href={c.cta_link} className="btn btn-gold btn-lg">{resolve(c.cta_texto)}</CtaButton>}
            {c.cta2_texto && <CtaButton href={c.cta2_link} className="btn btn-secondary btn-lg">{resolve(c.cta2_texto)}</CtaButton>}
          </div>
        )}
      </div>
    </section>
  );
}

/* Detecta a orientação do dispositivo (retrato no mobile em pé, paisagem em telas largas) */
function useOrientacao(): 'paisagem' | 'retrato' {
  const [orient, setOrient] = useState<'paisagem' | 'retrato'>('paisagem');
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => setOrient(mq.matches ? 'retrato' : 'paisagem');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return orient;
}

/* Escolhe a imagem do slide conforme a orientação do dispositivo */
function imagemDoSlide(s: SlideContent, orient: 'paisagem' | 'retrato'): string {
  if (orient === 'retrato' && s.imagem_retrato) return s.imagem_retrato;
  if (orient === 'paisagem' && s.imagem_paisagem) return s.imagem_paisagem;
  return s.imagem;
}

/* ── Carrossel base (compartilhado entre bloco carrossel e campanha) ── */
function CarrosselBase({ slides, resolve }: { slides: SlideContent[]; resolve: (s?: string | null) => string | null | undefined }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const orient = useOrientacao();

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  if (!slides.length) return null;

  const s = slides[current % slides.length];
  const img = imagemDoSlide(s, orient);
  return (
    <section className="hero" style={{ backgroundImage: img ? `url(${img})` : undefined }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="hero-overlay" />
      <div className="container hero-content">
        {s.badge && <span className="hero-badge">{resolve(s.badge)}</span>}
        {s.titulo && <h1 className="hero-title"><Titulo>{resolve(s.titulo)}</Titulo></h1>}
        {s.subtitulo && <p className="hero-subtitle">{resolve(s.subtitulo)}</p>}
        <div className="hero-cta-group">
          {s.cta1_label && <CtaButton href={s.cta1_link} className="btn btn-gold btn-lg">{resolve(s.cta1_label)}</CtaButton>}
          {s.cta2_label && <CtaButton href={s.cta2_link} className="btn btn-secondary btn-lg">{resolve(s.cta2_label)}</CtaButton>}
        </div>
        {slides.length > 1 && (
          <div className="hero-dots">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`hero-dot${i === current ? ' active' : ''}`} />
            ))}
          </div>
        )}
        <button className="hero-arrow prev" onClick={() => setCurrent(c => (c - 1 + slides.length) % slides.length)} aria-label="Slide anterior">❮</button>
        <button className="hero-arrow next" onClick={() => setCurrent(c => (c + 1) % slides.length)} aria-label="Próximo slide">❯</button>
      </div>
    </section>
  );
}

/* ── Carrossel Block ── */
function CarrosselBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const { campanha, imagens } = useCampanhaAtiva();
  const slidesCMS: SlideContent[] = ((bloco.conteudo?.slides || []) as SlideContent[]).filter(s => s.ativo !== false);
  const slidesCampanha = campanha ? campanhaParaSlides(campanha, imagens) : [];
  return <CarrosselBase slides={[...slidesCampanha, ...slidesCMS]} resolve={resolve} />;
}

/* ── Cards Block ── */
function CardsBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const cards: CardContent[] = bloco.conteudo?.cards || [];
  const c = bloco.conteudo || {};
  if (!cards.length) return null;
  const estilo = c.estilo || 'default';

  /* Variante "servicos": services-grid + diff-card (Qualidade Certificada) */
  if (estilo === 'servicos') {
    return (
      <section className="section">
        <div className="container">
          {(c.titulo || c.subtitulo) && (
            <div className="section-header reveal">
              {c.titulo && <h2>{resolve(c.titulo)}</h2>}
              {c.subtitulo && <p className="subtitle">{c.subtitulo}</p>}
              <span className="gold-line" />
            </div>
          )}
          <div className="services-grid">
            {cards.map((card, i) => (
              <div key={i} className="diff-card" style={{ textAlign:'left' }}>
                {(resolve(card.icone)) && <div style={{ fontSize:'2.5rem', marginBottom:'var(--spacing-md)' }}>{resolve(card.icone)}</div>}
                <h4>{resolve(card.titulo)}</h4>
                <p>{resolve(card.descricao)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  /* Variante "valores": values-grid + value-card (Missão, Visão e Valores) */
  if (estilo === 'valores') {
    return (
      <section className="section">
        <div className="container">
          {(c.titulo || c.subtitulo) && (
            <div className="section-header reveal">
              {c.titulo && <h2>{resolve(c.titulo)}</h2>}
              {c.subtitulo && <p className="subtitle">{c.subtitulo}</p>}
              <span className="gold-line" />
            </div>
          )}
          <div className="values-grid">
            {cards.map((card, i) => (
              <div key={i} className="value-card">
                {card.icone && <div className="value-icon">{resolve(card.icone)}</div>}
                <h4>{resolve(card.titulo)}</h4>
                <p>{resolve(card.descricao)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  /* Default: generic card grid */
  const sectionCls = estilo === 'section-alt' ? 'section section-alt' : 'section';
  return (
    <section className={sectionCls}>
      <div className="container">
        {(c.titulo || c.subtitulo) && (
          <div className="section-header reveal">
            {c.titulo && <h2>{resolve(c.titulo)}</h2>}
            {c.subtitulo && <p className="subtitle">{c.subtitulo}</p>}
            <span className="gold-line" />
          </div>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'var(--spacing-md)' }}>
          {cards.map((card, i) => (
            <div key={i} className="card" style={{ width:'min(100%, 324px)' }}>
              {card.icone && <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>{card.icone}</div>}
              <h3>{card.titulo}</h3>
              <p>{card.descricao}</p>
              {card.link && <CtaButton href={card.link} className="btn btn-gold" style={{ marginTop:'0.5rem' }}>Saiba Mais</CtaButton>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Diferenciais Block ── */
function DiferenciaisBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const itens: DiferencialContent[] = bloco.conteudo?.itens || [];
  if (!itens.length) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="section-header reveal">
          <h2>{resolve(bloco.conteudo?.titulo) || 'Nossos Diferenciais'}</h2>
          {bloco.conteudo?.subtitulo && <p className="subtitle">{resolve(bloco.conteudo.subtitulo)}</p>}
          <span className="gold-line" />
        </div>
        <div className="diff-grid">
          {itens.map((d, i) => (
            <div key={i} className="diff-card">
              {d.icone && <div className="diff-icon">{resolve(d.icone)}</div>}
              <h4>{resolve(d.titulo)}</h4>
              <p>{resolve(d.descricao)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Serviços Block ── */
function ServicosBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const itens: ServicoContent[] = bloco.conteudo?.itens || [];
  if (!itens.length) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="section-header reveal">
          <h2>{resolve(bloco.conteudo?.titulo) || 'Nossos Serviços'}</h2>
          {bloco.conteudo?.subtitulo && <p className="subtitle">{resolve(bloco.conteudo.subtitulo)}</p>}
          <span className="gold-line" />
        </div>
        <div className="services-grid">
          {itens.map((svc, i) => (
            <div key={i} className="service-card">
              {svc.imagem && (
                <div className="service-image">
                  <Image src={svc.imagem} alt={resolve(svc.titulo) || ''} fill style={{ objectFit:'cover' }} />
                </div>
              )}
              <div className="service-body">
                <h4>{resolve(svc.titulo)}</h4>
                <p>{resolve(svc.descricao)}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {svc.preco && <span className="service-price">{resolve(svc.preco)}</span>}
                  {svc.duracao && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>⏱ {resolve(svc.duracao)}</span>
                  )}
                </div>
                {svc.cta_label && (
                  <CtaButton href={svc.cta_link} className="btn btn-gold" style={{ marginTop:'0.75rem', display:'inline-block' }}>
                    {resolve(svc.cta_label)}
                  </CtaButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Depoimentos Block (carrossel com setas + link para avaliações no Google) ── */
function DepoimentosBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const itens: DepoimentoContent[] = bloco.conteudo?.itens || [];
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const linkGoogle = bloco.conteudo?.link_google as string | undefined;

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    window.addEventListener('resize', updateArrows);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateArrows);
    };
  }, [itens.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (!itens.length) return null;
  return (
    <section className="section section-alt">
      <div className="container">
        <div className="section-header reveal">
          <h2>{resolve(bloco.conteudo?.titulo) || 'Opinião dos Clientes'}</h2>
          {bloco.conteudo?.subtitulo && <p className="subtitle">{resolve(bloco.conteudo.subtitulo)}</p>}
          <span className="gold-line" />
        </div>
        <div className="testimonials-wrap">
          <button type="button" className="testimonial-arrow prev" aria-label="Avaliações anteriores" onClick={() => scrollByPage(-1)} disabled={!canPrev}>‹</button>
          <div className="testimonials-carousel" ref={trackRef} onScroll={updateArrows}>
            {itens.map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="testimonial-stars">
                  {Array.from({ length: t.estrelas || 5 }).map((_, j) => <span key={j}>⭐</span>)}
                </div>
                <p className="testimonial-text">{resolve(t.texto)}</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">
                    {t.avatar_url ? <Image src={t.avatar_url} alt={resolve(t.nome) || ''} width={40} height={40} style={{ borderRadius:'50%' }} /> : (resolve(t.nome) || '?')[0]}
                  </div>
                  <div>
                    <div className="testimonial-name">{resolve(t.nome)}</div>
                    {t.papel && <div className="testimonial-role">{resolve(t.papel)}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="testimonial-arrow next" aria-label="Próximas avaliações" onClick={() => scrollByPage(1)} disabled={!canNext}>›</button>
        </div>
        {linkGoogle && (
          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
            <a
              href={linkGoogle}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm google-reviews-link"
            >
              ⭐ {resolve(bloco.conteudo?.link_label) || 'Ver todas as avaliações no Google'} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Produtos Block (vitrine carregada via API no client) ── */
function ProdutosBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const [products, setProducts] = useState<ProdutoVitrine[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const max = Number(bloco.conteudo?.max_produtos) > 0 ? Number(bloco.conteudo?.max_produtos) : 8;
  const categoria = bloco.conteudo?.categoria || '';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/produtos?limit=${max}`);
        if (!res.ok) return;
        let data = await res.json();
        if (categoria) data = (data || []).filter((p: ProdutoVitrine) => p.category === categoria);
        if (active) setProducts(Array.isArray(data) ? data : []);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [max, categoria]);

  if (loading) return null;
  if (!products.length) return null;

  const origins = ['All', ...new Set(products.map(p => p.origin).filter((o): o is string => !!o))];
  const filtered = filter === 'All' ? products : products.filter(p => p.origin === filter);

  return (
    <section className="section section-alt">
      <div className="container">
        <div className="section-header reveal">
          <h2>{resolve(bloco.conteudo?.titulo) || 'Our Collection'}</h2>
          {bloco.conteudo?.subtitulo && <p className="subtitle">{resolve(bloco.conteudo.subtitulo)}</p>}
          <span className="gold-line" />
        </div>
        {origins.length > 1 && (
          <div className="products-tabs reveal">
            {origins.map(o => <button key={o} className={`products-tab ${filter === o ? 'active' : ''}`} onClick={() => setFilter(o)}>{o}</button>)}
          </div>
        )}
        <div className="products-grid stagger">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {(bloco.conteudo?.cta1_label || bloco.conteudo?.cta2_label) && (
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap', marginTop: 'var(--spacing-2xl)' }}>
            {bloco.conteudo?.cta1_label && <CtaButton href={bloco.conteudo?.cta1_link} className="btn btn-gold btn-lg">{resolve(bloco.conteudo.cta1_label)}</CtaButton>}
            {bloco.conteudo?.cta2_label && <CtaButton href={bloco.conteudo?.cta2_link} className="btn btn-secondary btn-lg">{resolve(bloco.conteudo.cta2_label)}</CtaButton>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Galeria Block ── */
function GaleriaBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const itens: GaleriaItemContent[] = (bloco.conteudo?.itens || []).filter((i: GaleriaItemContent) => i.ativo !== false);
  const catsRaw: string = bloco.conteudo?.categorias || 'All';
  const cats = catsRaw.split(',').map((c: string) => c.trim());
  const [filter, setFilter] = useState(cats[0] || 'All');
  const [lb, setLb] = useState<number | null>(null);
  const filtered = filter === cats[0] ? itens : itens.filter(i => i.categoria === filter);
  if (!itens.length) return null;

  const isVideo = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

  return (
    <>
      <section className="section about-hero">
        <div className="container">
          <span className="badge badge-gold" style={{ marginBottom:'var(--spacing-md)' }}>Gallery</span>
          <h1>{resolve(bloco.conteudo?.titulo) || 'Our Gallery'}</h1>
          {bloco.conteudo?.subtitulo && <p>{resolve(bloco.conteudo.subtitulo)}</p>}
          <span className="gold-line" />
        </div>
      </section>
      <section className="section" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="container">
          <div className="products-tabs" style={{ marginBottom:'var(--spacing-2xl)' }}>
            {cats.map(c => <button key={c} className={`products-tab ${filter===c?'active':''}`} onClick={() => setFilter(c)}>{c}</button>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:'var(--spacing-md)' }}>
            {filtered.map((item, i) => (
              <div key={i} onClick={() => setLb(i)} style={{ position:'relative', borderRadius:'var(--radius-lg)', overflow:'hidden', cursor:'pointer', aspectRatio:'4/5', background:'var(--color-surface)' }}>
                {isVideo(item.url) ? (
                  <video src={item.url} muted loop playsInline preload="metadata" style={{ width:'100%', height:'100%', objectFit:'cover' }} onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                ) : (
                  <Image src={item.url} alt={item.alt || item.titulo} fill style={{ objectFit:'cover' }} />
                )}
                <div style={{ position:'absolute', top:10, right:10, width:34, height:34, borderRadius:'50%', background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'1rem', pointerEvents:'none' }}>
                  ▶
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {lb !== null && (
        <div className="modal-overlay active" onClick={() => setLb(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position:'relative' }}>
            {isVideo(filtered[lb].url) ? (
              <video src={filtered[lb].url} controls autoPlay playsInline style={{ maxWidth:'90vw', maxHeight:'85vh', borderRadius:'var(--radius-lg)' }} />
            ) : (
              <Image src={filtered[lb].url} alt="" width={1000} height={750} style={{ maxHeight:'85vh', objectFit:'contain', borderRadius:'var(--radius-lg)' }} />
            )}
            <button onClick={() => setLb(null)} style={{ position:'absolute', top:12, right:12, width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,0.5)', color:'white', border:'none', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── CTA Block ── */
function CtaBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const c = bloco.conteudo || {};
  return (
    <section className="section cta-banner" style={c.imagem_fundo ? { backgroundImage:`url(${c.imagem_fundo})`, backgroundSize:'cover', backgroundPosition:'center' } : {}}>
      <div className="container">
        {c.titulo && <h2>{resolve(c.titulo)}</h2>}
        <span className="gold-line" style={{ margin:'var(--spacing-md) auto' }} />
        {c.subtitulo && <p>{resolve(c.subtitulo)}</p>}
        <div style={{ display:'flex', gap:'var(--spacing-md)', justifyContent:'center', flexWrap:'wrap' }}>
          {c.texto_botao && <CtaButton href={c.link_botao} className="btn btn-gold btn-lg">{resolve(c.texto_botao)}</CtaButton>}
          {c.texto_botao2 && <CtaButton href={c.link_botao2} className="btn btn-secondary btn-lg">{resolve(c.texto_botao2)}</CtaButton>}
        </div>
      </div>
    </section>
  );
}

/* ── About Block (about-grid: imagem + texto lado a lado) ── */
function AboutBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const c = bloco.conteudo || {};
  return (
    <section className="section">
      <div className="container">
        <div className="about-grid">
          <div className="about-image-wrap">
            <Image src={c.imagem || '/images/hero-1.jpg'} alt={resolve(c.titulo) || 'Sobre'} fill style={{ objectFit:'cover' }} />
          </div>
          <div className="about-text">
            {c.titulo && <h2>{resolve(c.titulo)}</h2>}
            {c.texto_html && <div dangerouslySetInnerHTML={{ __html: resolve(c.texto_html) || '' }} />}
            {c.cta_label && (
              <CtaButton href={c.cta_link} className="btn btn-primary" style={{ marginTop:'var(--spacing-lg)' }}>
                {resolve(c.cta_label)}
              </CtaButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Texto/HTML Blocks ── */
function TextoBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  return <section className="section"><div className="container" dangerouslySetInnerHTML={{ __html: resolve(bloco.conteudo?.conteudo_html) || '' }} /></section>;
}

/* ── Html Block com tokens {{token}} resolvidos via Dados da Empresa ── */
function HtmlBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const css = bloco.conteudo?.css;
  return (
    <>
      {typeof css === 'string' && css.trim() && (
        <style dangerouslySetInnerHTML={{ __html: resolve(css) || '' }} />
      )}
      <div dangerouslySetInnerHTML={{ __html: resolve(bloco.conteudo?.codigo) || '' }} />
    </>
  );
}

/* ── Lead Block ── */
function LeadBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const c = bloco.conteudo || {};
  const campos: any[] = c.campos || [];
  const [fd, setFd] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const fmt = (v: string) => { const d=v.replace(/\D/g,'').slice(0,11); return d.length<=2?d:d.length<=7?`(${d.slice(0,2)}) ${d.slice(2)}`:`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await registerLead(fd.name || '', fd.whatsapp || '', fd.email || ''); setSent(true); } catch {} finally { setLoading(false); }
  };
  if (sent) return (
    <section className="section lead-section" style={{ textAlign:'center' }}>
      <div className="container"><div style={{ fontSize:'4rem' }}>🎉</div><h2>Recebemos seus dados!</h2><p className="subtitle">Entraremos em contato em breve.</p><span className="gold-line" style={{ margin:'1rem auto' }} /></div>
    </section>
  );
  const inpS: React.CSSProperties = { width:'100%', padding:'0.875rem 1rem', borderRadius:'8px', border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)', fontSize:'1rem' };
  return (
    <section className="section lead-section" id="lead-form">
      <div className="container">
        <div className="lead-grid">
          <div className="lead-info reveal">
            <h2>{c.titulo || 'Ganhe Seu Desconto Exclusivo'}</h2>
            {c.subtitulo && <p>{resolve(c.subtitulo)}</p>}
            <div className="lead-benefits">
              <div className="lead-benefit"><div className="lead-benefit-icon">🎁</div><span>Desconto exclusivo na primeira compra</span></div>
              <div className="lead-benefit"><div className="lead-benefit-icon">📱</div><span>Novidades e promoções em primeira mão</span></div>
              <div className="lead-benefit"><div className="lead-benefit-icon">💇‍♀️</div><span>Dicas de cuidados e manutenção</span></div>
              <div className="lead-benefit"><div className="lead-benefit-icon">⭐</div><span>Acesso ao programa de fidelidade</span></div>
            </div>
          </div>
          <div className="lead-form-card reveal" style={{ animationDelay:'200ms' }}>
            {c.form_titulo && <h3>{resolve(c.form_titulo)}</h3>}
            {c.form_subtitulo && <p className="form-subtitle">{resolve(c.form_subtitulo)}</p>}
            <form className="lead-form" onSubmit={submit}>
              {campos.map((campo: any, i: number) => (
                <div key={i} className="input-group">
                  <label htmlFor={`lead-${campo.nome}`}>{resolve(campo.label)}{(campo.obrigatorio !== 'false') ? ' *' : ''}</label>
                  <input id={`lead-${campo.nome}`}
                    className="input"
                    type={campo.tipo === 'email' ? 'email' : campo.tipo === 'tel' ? 'tel' : 'text'}
                    placeholder={resolve(campo.label) || ''}
                    required={campo.obrigatorio !== 'false'}
                    value={campo.nome === 'whatsapp' ? fmt(fd[campo.nome] || '') : (fd[campo.nome] || '')}
                    onChange={e => setFd(p => ({...p, [campo.nome]: e.target.value}))}
                  />
                </div>
              ))}
              <button type="submit" disabled={loading} className="btn btn-gold">
                {loading ? 'Enviando...' : (resolve(c.texto_botao) || '🎁 Quero Meu Desconto')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Form Block ── */
function FormBlock({ bloco }: { bloco: CmsBloco }) {
  const resolve = useTokens();
  const c = bloco.conteudo || {};
  const campos: any[] = c.campos || [];
  const [fd, setFd] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); try { await fetch('/api/contato', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fd) }); setSent(true); } catch {} finally { setLoading(false); } };
  if (sent) return <section className="section"><div className="container" style={{ textAlign:'center' }}><h2>{resolve(c.texto_sucesso) || 'Mensagem enviada!'}</h2></div></section>;
  return (
    <section className="section">
      <div className="container" style={{ maxWidth:600 }}>
        {c.titulo && <h2 style={{ textAlign:'center' }}>{resolve(c.titulo)}</h2>}
        {c.subtitulo && <p className="subtitle" style={{ textAlign:'center' }}>{resolve(c.subtitulo)}</p>}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem', marginTop:'2rem' }}>
          {campos.map((campo: any, i: number) => (
            <div key={i}>
              <label style={{ display:'block', marginBottom:'0.25rem', fontSize:'0.875rem' }}>{resolve(campo.label)}{campo.obrigatorio !== 'false' ? ' *' : ''}</label>
              {campo.tipo === 'textarea'
                ? <textarea style={{ width:'100%', padding:'0.75rem', borderRadius:'8px', border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)', minHeight:120 }} required={campo.obrigatorio !== 'false'} value={fd[campo.nome] || ''} onChange={e => setFd(p => ({...p, [campo.nome]: e.target.value}))} />
                : campo.tipo === 'select'
                ? <select style={{ width:'100%', padding:'0.75rem', borderRadius:'8px', border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)' }} required={campo.obrigatorio !== 'false'} value={fd[campo.nome] || ''} onChange={e => setFd(p => ({...p, [campo.nome]: e.target.value}))}>
                    {(campo.opcoes || '').split(',').map((opt: string, j: number) => (
                      <option key={j} value={j === 0 ? '' : opt.trim()} disabled={j === 0} style={{ color:'black' }}>{opt.trim()}</option>
                    ))}
                  </select>
                : <input type={campo.tipo || 'text'} style={{ width:'100%', padding:'0.75rem', borderRadius:'8px', border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)' }} required={campo.obrigatorio !== 'false'} value={fd[campo.nome] || ''} onChange={e => setFd(p => ({...p, [campo.nome]: e.target.value}))} />
              }
            </div>
          ))}
          <button type="submit" disabled={loading} className="btn btn-gold btn-lg">{loading ? 'Enviando...' : 'Enviar'}</button>
        </form>
      </div>
    </section>
  );
}

/* ── Campanha Block (módulo de campanhas promocionais) ── */
function CampanhaBlock({ bloco, temCarrossel = false }: { bloco: CmsBloco; temCarrossel?: boolean }) {
  const resolve = useTokens();
  const { campanha, imagens } = useCampanhaAtiva();
  const [CampanhaSeccao, setCampanhaSeccao] = useState<React.FC<{ titulo?: string }> | null>(null);
  useEffect(() => {
    import('@/components/campanhas/CampanhaSeccao').then((m) => setCampanhaSeccao(() => m.default));
  }, []);
  const slides = campanha ? campanhaParaSlides(campanha, imagens) : [];
  return (
    <>
      {/* Se a página não tem carrossel principal, insere um com os slides da campanha */}
      {!temCarrossel && <CarrosselBase slides={slides} resolve={resolve} />}
      {CampanhaSeccao && <CampanhaSeccao titulo={bloco.conteudo?.titulo || undefined} />}
    </>
  );
}

/* ── Mapeamento tipo → componente ── */
const RENDERERS: Record<string, React.FC<{ bloco: CmsBloco; temCarrossel?: boolean }>> = {
  hero: HeroBlock, about: AboutBlock, carrossel: CarrosselBlock,
  cards: CardsBlock, diferenciais: DiferenciaisBlock,
  servicos: ServicosBlock, produtos: ProdutosBlock,
  depoimentos: DepoimentosBlock, galeria: GaleriaBlock,
  cta: CtaBlock, texto: TextoBlock, html: HtmlBlock,
  form: FormBlock, lead: LeadBlock, campanha: CampanhaBlock,
};

export default function CmsBlockRenderer({ blocos }: { blocos: CmsBloco[] }) {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [campanhaAtiva, setCampanhaAtiva] = useState<CampanhaAtivaData>(CAMPANHA_VAZIA);

  useEffect(() => {
    let active = true;
    getConfigs().then(c => { if (active) setConfigs(c); });
    return () => { active = false; };
  }, []);

  // Carrega a campanha elegível uma única vez e fornece via contexto,
  // para o carrossel principal e o bloco campanha usarem juntos.
  const temModuloCampanha = blocos.some(b => b.tipo === 'campanha' || b.tipo === 'carrossel');
  useEffect(() => {
    if (!temModuloCampanha) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/campanhas/ativas');
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.campanha) {
          setCampanhaAtiva({
            campanha: data.campanha,
            imagens: data.imagens || [],
            decoracoes: data.decoracoes || [],
          });
        }
      } catch { /* sem campanha ativa */ }
    })();
    return () => { active = false; };
  }, [temModuloCampanha]);

  const resolve = (s?: string | null) => (s ? resolveTokens(s, configs) : s);

  if (!blocos.length) return null;
  const temCarrossel = blocos.some(b => b.tipo === 'carrossel');
  return (
    <TokenCtx.Provider value={resolve}>
      <CampanhaCtx.Provider value={campanhaAtiva}>
        {blocos.map((b, i) => {
          const C = RENDERERS[b.tipo];
          if (!C) return null;
          // Efeito zebra automático: alterna leve diferença de fundo entre blocos
          // conforme a ordem (se um bloco muda, as cores se ajustam sozinhas).
          return (
            <div key={b.id} className={`bloco-zone ${i % 2 === 0 ? 'zebra-a' : 'zebra-b'}`}>
              <C bloco={b} temCarrossel={temCarrossel} />
            </div>
          );
        })}
      </CampanhaCtx.Provider>
    </TokenCtx.Provider>
  );
}
