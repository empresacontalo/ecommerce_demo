'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

export default function Footer() {
  const [linksVisiveis, setLinksVisiveis] = useState<{ href: string; label: string }[]>([
    { href: '/', label: 'Home' }, { href: '/sobre', label: 'About Us' },
    { href: '/catalogo', label: 'Catalog' },
    { href: '/encontre-seu-cheiro', label: 'Find Your Scent' },
    { href: '/galeria', label: 'Gallery' },
    { href: '/auth/login', label: 'My Account' },
  ]);
  const [dados, setDados] = useState<{
    nome: string; nomeParte1: string; nomeResto: string; subtitulo: string;
    descricao: string;
    end: Record<string, string>; hr: Record<string, string>;
    tel: Record<string, string>; ig: Record<string, string>; fb: Record<string, string>; wa: Record<string, string>; tk: Record<string, string>;
  }>({
    nome: EMPRESA_NOME_PADRAO, nomeParte1: EMPRESA_NOME_PADRAO.split(' ')[0], nomeResto: EMPRESA_NOME_PADRAO.split(' ').slice(1).join(' '), subtitulo: '',
    descricao: '',
    end: {}, hr: {}, tel: {}, ig: {}, fb: {}, wa: {}, tk: {},
  });

  useEffect(() => {
    (async () => {
      const [logo, endereco, horario, telefone, instagram, facebook, whatsapp, descricao, tiktok] = await Promise.all([
        getConfig('header.logo'),
        getConfig('footer.endereco'),
        getConfig('footer.horario'),
        getConfig('footer.contato.telefone'),
        getConfig('footer.contato.instagram'),
        getConfig('empresa.facebook'),
        getConfig('footer.contato.whatsapp'),
        getConfig('footer.descricao'),
        getConfig('footer.contato.tiktok'),
      ]);
      const nome = logo?.texto || EMPRESA_NOME_PADRAO;
      const parts = nome.split(' ');
      setDados({
        nome,
        nomeParte1: parts[0] || nome,
        nomeResto: parts.slice(1).join(' '),
        subtitulo: logo?.subtitulo || '',
        descricao: typeof descricao === 'string' ? descricao : (descricao?.texto || ''),
        end: endereco || {}, hr: horario || {}, tel: telefone || {}, ig: instagram || {}, fb: facebook || {}, wa: whatsapp || {}, tk: tiktok || {},
      });
    })();
  }, []);

  // Filtra os links rápidos pelas páginas ativas
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cms/paginas', { cache: 'no-store' });
        if (!res.ok) return;
        const paginas = await res.json();
        const inativas = new Set(paginas.filter((p: any) => !p.ativo).map((p: any) => p.slug));
        setLinksVisiveis(prev => prev.filter(l => {
          const slug = l.href === '/' ? 'home' : l.href.replace('/', '').split('/')[0];
          return !inativas.has(slug);
        }));
      } catch { /* mantém todos */ }
    })();
  }, []);

  const { nome, nomeParte1, nomeResto, subtitulo, end, hr, tel, ig, fb, wa, tk } = dados;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(`${end.linha1 || ''}, ${end.cidade || ''}`)}&output=embed`;

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-main">
        <div className="container">
          <div className="footer-grid">
            {/* Col 1 — About */}
            <div className="footer-col">
              <div className="footer-brand">
                <div className="footer-logo-text">{nomeParte1} {nomeResto && <span>{nomeResto}</span>}</div>
                <p className="footer-tagline">{subtitulo}</p>
              </div>
              <p className="footer-desc">
                {dados.descricao || 'Curators of world-renowned luxury fragrances and rare oriental elixirs. Engineered for exceptional longevity, depth, and timeless distinction.'}
              </p>
              <div className="footer-social">
                {wa.link && <a href={wa.link} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.938 1.395 5.617L.02 23.98l6.531-1.314A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.66-.506-5.22-1.44l-.375-.22-3.885.78.825-3.81-.248-.39A9.68 9.68 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
                </a>}
                {ig.link && ig.usuario && <a href={ig.link} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>}
                {tk.link && tk.usuario && <a href={tk.link} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                </a>}
                {fb.link && <a href={fb.link} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>}
              </div>
            </div>

            {/* Col 2 — Links */}
            <div className="footer-col">
              <h4 className="footer-heading">Quick Links</h4>
              <ul className="footer-links">
                {linksVisiveis.map(l => (
                  <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
                ))}
              </ul>
            </div>

            {/* Col 3 — Location */}
            <div className="footer-col">
              <h4 className="footer-heading">Location</h4>
              <address className="footer-address">
                {end.linha1 && <p>{end.linha1}</p>}
                {end.linha2 && <p>{end.linha2}</p>}
                {end.cidade && <p>{end.cidade}</p>}
                {end.cep && <p>{end.cep}</p>}
              </address>
              <div className="footer-map">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="120"
                  style={{ border: 0, borderRadius: 'var(--radius-md)' }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${nome} location`}
                />
              </div>
            </div>

            {/* Col 4 — Contact */}
            <div className="footer-col">
              <h4 className="footer-heading">Contact</h4>
              <ul className="footer-contact">
                {tel.link && <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <a href={tel.link}>{tel.numero}</a>
                </li>}
                {ig.link && ig.usuario && <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  <a href={ig.link} target="_blank" rel="noopener noreferrer">{ig.usuario}</a>
                </li>}
                {tk.link && tk.usuario && <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                  <a href={tk.link} target="_blank" rel="noopener noreferrer">{tk.usuario}</a>
                </li>}
              </ul>
              {(hr.semana || hr.sabado) && (
                <div className="footer-hours">
                  <h5 style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>
                    Business Hours
                  </h5>
                  {hr.semana && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>{hr.semana}</p>}
                  {hr.sabado && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>{hr.sabado}</p>}
                  {hr.domingo && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>{hr.domingo}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="container">
          <div className="footer-bottom-inner">
            <p>© {new Date().getFullYear()} {nome}. All rights reserved.</p>
            <div className="footer-legal">
              <Link href="/politica-de-privacidade">Privacy Policy</Link>
              <span>·</span>
              <Link href="/termos-de-uso">Terms of Use</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
