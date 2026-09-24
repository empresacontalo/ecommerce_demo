'use client';

import '../admin.css';
import '@/components/layout/header.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/auth/client';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';
import { installAdminSessionGuard, getOriginalFetch } from '@/utils/admin-session-guard';
import { getDraft, replayDraft, consumeDraftResult } from '@/utils/admin-draft';
import { isNomeIconeLogo, iconeLogoParaEmoji } from '@/utils/logo-icones';
import { useState, useEffect } from 'react';

interface EmpresaLogo {
  logoTexto: string;
  logoSubtitulo: string;
  logoImagem: string;
}

/** Mesmo logo/texto do site público (header.logo + header.logo_imagem). */
function LogoAdmin({ empresa, href = '/admin' }: { empresa: EmpresaLogo; href?: string }) {
  return (
    <Link href={href} className="header-logo admin-logo" aria-label={`${empresa.logoTexto} - Painel Administrativo`}>
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
  );
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  )},
  { href: '/admin/conteudo', label: 'Conteúdo', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  )},
  { href: '/admin/auditoria', label: 'Auditoria', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
  )},
  /* { href: '/admin/leads', label: 'Leads', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )}, */
  { href: '/admin/pedidos', label: 'Pedidos', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
  )},
  { href: '/admin/agendamentos', label: 'Agendamentos', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )},
  { href: '/admin/produtos', label: 'Produtos', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
  )},
  { href: '/admin/campanhas', label: 'Campanhas', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  )},
  { href: '/admin/trafego-pago', label: 'Tráfego Pago', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
  )},
  { href: '/admin/carrossel', label: 'Carrossel', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 18v3"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg>
  )},
  { href: '/admin/galeria', label: 'Galeria', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
  )},
  { href: '/admin/configuracoes', label: 'Configurações', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  )},
  { href: '/admin/configuracoes/usuarios', label: 'Usuários Admin', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { href: '/admin/configuracoes/limites', label: 'Limites de Acesso', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  )},
  { href: '/admin/backups', label: 'Backup', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
  )},
];

const BOTTOM_ITEMS = [
  { href: '/', label: 'Ver Site', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  )},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const client = createClient();
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaLogo>({
    logoTexto: EMPRESA_NOME_PADRAO,
    logoSubtitulo: '',
    logoImagem: '',
  });
  const [draftNotice, setDraftNotice] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Sessão expirou durante um save? Guard salva o draft e manda p/ login.
  useEffect(() => {
    installAdminSessionGuard();
  }, []);

  // Toast pós-login (draft reenviado na tela de login ou aqui em fluxos OAuth).
  useEffect(() => {
    if (!draftNotice) return;
    const t = setTimeout(() => setDraftNotice(null), 8000);
    return () => clearTimeout(t);
  }, [draftNotice]);

  async function handlePendingDraft() {
    const resultado = consumeDraftResult();
    if (resultado) {
      setDraftNotice(
        resultado === 'ok'
          ? { tipo: 'ok', texto: '✓ Seus dados foram salvos com sucesso no banco.' }
          : { tipo: 'erro', texto: '✕ Não foi possível salvar seus dados após o novo login. Tente salvar novamente.' }
      );
      return;
    }
    const draft = getDraft();
    if (!draft) return;
    const r = await replayDraft(draft, getOriginalFetch());
    setDraftNotice(
      r.ok
        ? { tipo: 'ok', texto: '✓ Seus dados foram salvos com sucesso no banco.' }
        : { tipo: 'erro', texto: `✕ Não foi possível salvar seus dados após o novo login (${r.error}). Tente salvar novamente.` }
    );
  }

  // Logo idêntico ao do site público (texto, subtítulo e imagem/ícone)
  useEffect(() => {
    (async () => {
      const [logo, logoImg] = await Promise.all([
        getConfig('header.logo'),
        getConfig('header.logo_imagem'),
      ]);
      setEmpresa({
        logoTexto: logo?.texto || EMPRESA_NOME_PADRAO,
        logoSubtitulo: logo?.subtitulo || '',
        logoImagem: logoImg || '',
      });
    })();
  }, []);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await client.auth.getUser();

      if (!user) {
        router.push('/auth/login?next=/admin');
        return;
      }

      try {
        const res = await fetch('/api/admin/check-admin', { cache: 'no-store' });
        const data = await res.json();

        if (!data.isAdmin) {
          console.log('[AdminLayout] API negou acesso:', data);
          setLoading(false);
          setNotAuthorized(true);
        } else {
          setLoading(false);
          handlePendingDraft();
        }
      } catch (err) {
        console.error('[AdminLayout] Erro ao verificar permissões via API:', err);
        setLoading(false);
        setNotAuthorized(true);
      }
    }
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);


  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const handleLogout = async () => {
    await client.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-dark)', color: 'var(--color-gold)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem', justifyContent: 'center' }}><LogoAdmin empresa={empresa} /></div>
          Verificando acesso...
        </div>
      </div>
    );
  }

  if (notAuthorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-dark)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center', background: 'var(--color-surface)', padding: '40px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔐</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Acesso Restrito</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '30px', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Sua conta ainda não possui permissão de administrador aprovada. Entre em contato com um administrador pré-aprovado.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handleLogout} className="btn btn-gold btn-lg" style={{ width: '100%' }}>
              Sair da Conta
            </button>
            <Link href="/" className="btn btn-secondary" style={{ width: '100%' }}>
              Voltar ao Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {draftNotice && (
        <div
          className={`admin-draft-toast ${draftNotice.tipo}`}
          role="status"
          aria-live="polite"
        >
          {draftNotice.texto}
        </div>
      )}
      <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <LogoAdmin empresa={empresa} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Painel Admin</span>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <nav className="admin-nav admin-nav-bottom">
          {BOTTOM_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="admin-nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: '#ef4444' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sair
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-title">
            {NAV_ITEMS.find(i => isActive(i.href))?.label ||
             BOTTOM_ITEMS.find(i => isActive(i.href))?.label ||
             'Painel Admin'}
          </div>
          <div className="admin-header-actions">
            <div className="admin-avatar">AD</div>
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
    </>
  );
}
