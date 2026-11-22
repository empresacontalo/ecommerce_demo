'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/utils/auth/client';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';
import { isNomeIconeLogo, iconeLogoParaEmoji } from '@/utils/logo-icones';
import CtaButton from '@/components/CtaButton';

const NAV_LINKS = [
  { href: '/', label: 'Home', slug: 'home' },
  { href: '/sobre', label: 'About', slug: 'sobre' },
  { href: '/catalogo', label: 'Catalog', slug: 'catalogo' },
  { href: '/encontre-seu-cheiro', label: 'Find Your Scent', slug: 'encontre-seu-cheiro' },
  { href: '/galeria', label: 'Gallery', slug: 'galeria' },
];

const SLUG_TO_HREF: Record<string, string> = {
  home: '/', sobre: '/sobre', 'catalogo': '/catalogo',
  'encontre-seu-cheiro': '/encontre-seu-cheiro', galeria: '/galeria',
};

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [linksVisiveis, setLinksVisiveis] = useState<{ href: string; label: string }[]>(NAV_LINKS.map(({ href, label }) => ({ href, label })));
  const [empresa, setEmpresa] = useState<{ logoTexto: string; logoSubtitulo: string; logoImagem: string; telefone: string; whatsappLink: string; instagramLink: string; tiktokLink: string }>({
    logoTexto: EMPRESA_NOME_PADRAO,
    logoSubtitulo: '',
    logoImagem: '',
    telefone: '',
    whatsappLink: '',
    instagramLink: '',
    tiktokLink: '',
  });
  const pathname = usePathname();
  const { totalItems, openCart } = useCart();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const [logo, tel, wa, ig, tk, logoImg] = await Promise.all([
        getConfig('header.logo'),
        getConfig('footer.contato.telefone'),
        getConfig('whatsapp.numero'),
        getConfig('footer.contato.instagram'),
        getConfig('footer.contato.tiktok'),
        getConfig('header.logo_imagem'),
      ]);
      setEmpresa({
        logoTexto: logo?.texto || EMPRESA_NOME_PADRAO,
        logoSubtitulo: logo?.subtitulo || '',
        logoImagem: logoImg || '',
        telefone: tel?.numero || '',
        whatsappLink: wa?.link || '',
        instagramLink: ig?.link || '',
        tiktokLink: tk?.link || '',
      });
    })();
  }, []);

  // Filtra os links do menu pelas páginas ativas
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cms/paginas', { cache: 'no-store' });
        if (!res.ok) return;
        const paginas = await res.json();
        const inativas = new Set(paginas.filter((p: any) => !p.ativo).map((p: any) => p.slug));
        setLinksVisiveis(
          NAV_LINKS
            .filter(l => !l.slug || !inativas.has(l.slug))
            .map(({ href, label }) => ({ href, label }))
        );
      } catch { /* mantém todos os links */ }
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Verifica se o usuário logado é administrador aprovado (ícone de engrenagem)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/check-admin', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch { /* usuário não admin */ }
    })();
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const profileHref = user ? '/minha-conta' : '/auth/login';

  return (
    <>
      <header className={`header ${scrolled ? 'scrolled' : ''}`} role="banner">
        <div className="header-inner">
          {/* Logo */}
          <Link href="/" className="header-logo" aria-label={`${empresa.logoTexto} - Página Inicial`}>
            {isNomeIconeLogo(empresa.logoImagem) ? (
              <span className="header-logo-icon" role="img" aria-label={empresa.logoTexto}>{iconeLogoParaEmoji(empresa.logoImagem)}</span>
            ) : empresa.logoImagem ? (
              <img src={empresa.logoImagem} alt={empresa.logoTexto} height={40} style={{ objectFit: 'contain', maxWidth: 180 }} />
            ) : (
              <div>
                <div className="header-logo-text">{empresa.logoTexto.split(' ')[0]} {empresa.logoTexto.split(' ').length > 1 && <span>{empresa.logoTexto.split(' ').slice(1).join(' ')}</span>}</div>
                <span className="header-logo-sub">{empresa.logoSubtitulo}</span>
              </div>
            )}
          </Link>

          {/* Desktop Nav */}
          <nav className="header-nav" aria-label="Main navigation">
            {linksVisiveis.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? 'active' : ''}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="header-actions">
            <CtaButton href="chat:atendimento" className="btn btn-primary btn-sm header-cta">
              Chat With Us
            </CtaButton>

            <Link href={profileHref} className="header-icon" aria-label="My account" style={{ color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>

            {isAdmin && (
              <a
                href="/admin"
                target="_blank"
                rel="noopener noreferrer"
                className="header-icon"
                aria-label="Admin panel"
                title="Admin panel"
                style={{ color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </a>
            )}

            <button className="header-cart" onClick={openCart} aria-label="Shopping cart">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {totalItems > 0 && <span className="header-cart-count">{totalItems}</span>}
            </button>

            {/* Hamburger */}
            <button
              className={`header-hamburger ${drawerOpen ? 'open' : ''}`}
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Drawer */}
      <nav
        className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}
        aria-label="Menu mobile"
        role="dialog"
      >
        <div className="mobile-drawer-header">
          {isNomeIconeLogo(empresa.logoImagem) ? (
            <span className="header-logo-icon" role="img" aria-label={empresa.logoTexto} style={{ fontSize: '2rem' }}>{iconeLogoParaEmoji(empresa.logoImagem)}</span>
          ) : empresa.logoImagem ? (
            <img src={empresa.logoImagem} alt={empresa.logoTexto} height={36} style={{ objectFit: 'contain', maxWidth: 160 }} />
          ) : (
            <>
              <div className="header-logo-text" style={{fontSize: '1.5rem'}}>{empresa.logoTexto.split(' ')[0]} <span style={{color:'var(--color-gold)'}}>{empresa.logoTexto.split(' ').slice(1).join(' ')}</span></div>
              <span className="header-logo-sub">{empresa.logoSubtitulo}</span>
            </>
          )}
        </div>

        <div className="mobile-drawer-nav">
          {linksVisiveis.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'active' : ''}
              onClick={() => setDrawerOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {user && (
            <Link
              href="/minha-conta"
              className={pathname === '/minha-conta' ? 'active' : ''}
              style={{ color: 'var(--color-gold)', fontWeight: 600 }}
              onClick={() => setDrawerOpen(false)}
            >
              My Account
            </Link>
          )}

          {isAdmin && (
            <a
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-gold)', fontWeight: 600 }}
            >
              ⚙️ Admin Panel
            </a>
          )}

          {user && (
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setDrawerOpen(false);
                window.location.href = '/';
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--color-error)', 
                textAlign: 'left', 
                padding: 'var(--spacing-sm) 0',
                fontSize: 'var(--text-md)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Sign Out
            </button>
          )}

          <CtaButton
            href="chat:atendimento"
            className="btn btn-primary"
            style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}
            onClick={() => setDrawerOpen(false)}
          >
            Chat With Us
          </CtaButton>
        </div>

        <div className="mobile-drawer-footer">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            📞 {empresa.telefone}
          </p>
          <div className="mobile-drawer-social">
            {empresa.whatsappLink && <a href={empresa.whatsappLink} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.938 1.395 5.617L.02 23.98l6.531-1.314A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.66-.506-5.22-1.44l-.375-.22-3.885.78.825-3.81-.248-.39A9.68 9.68 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
            </a>}
            {empresa.instagramLink && <a href={empresa.instagramLink} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>}
            {empresa.tiktokLink && <a href={empresa.tiktokLink} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
            </a>}
          </div>
        </div>
      </nav>
    </>
  );
}
