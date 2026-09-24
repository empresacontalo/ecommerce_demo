'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/auth/client';
import { getConfig } from '@/utils/empresa';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';
import AuthLogo from '@/components/AuthLogo';
import { validarCpf, formatarCpf } from '@/utils/cpf';

function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const supabase = createClient();
  const [empresaNome, setEmpresaNome] = useState(EMPRESA_NOME_PADRAO);

  useEffect(() => {
    (async () => {
      const logo = await getConfig('header.logo');
      if (logo?.texto) setEmpresaNome(logo.texto);
    })();
  }, []);

  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirm: '', cpf: '', phone: '' });  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!validarCpf(formData.cpf)) {
      setError('CPF inválido. Verifique os números digitados.');
      return;
    }
    setLoading(true);
    setError('');
    
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          cpf: formData.cpf,
          phone: formData.phone,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (data?.user) {
        router.push(next);
        router.refresh();
      } else {
        setError('Conta criada! Por favor, verifique seu e-mail para confirmar (caso exigido) ou faça login.');
        setLoading(false);
      }
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <AuthLogo />
        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">Junte-se à família {empresaNome}</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <button
          type="button"
          className="btn btn-secondary btn-lg auth-social-btn"
          onClick={handleGoogleSignUp}
          disabled={loading}
          id="google-register-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Criar conta com Google
        </button>

        <div className="auth-divider">ou preencha seus dados</div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="reg-name">Nome completo</label>
            <input id="reg-name" className="input" type="text" placeholder="Seu nome" required value={formData.name} onChange={set('name')} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <div className="input-group">
              <label htmlFor="reg-cpf">CPF</label>
              <input id="reg-cpf" className="input" type="text" placeholder="000.000.000-00" required value={formData.cpf} onChange={e => setFormData(prev => ({ ...prev, cpf: formatarCpf(e.target.value) }))} />
            </div>
            <div className="input-group">
              <label htmlFor="reg-phone">WhatsApp</label>
              <input id="reg-phone" className="input" type="text" placeholder="(00) 00000-0000" required value={formData.phone} onChange={set('phone')} />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="reg-email">E-mail</label>
            <input id="reg-email" className="input" type="email" placeholder="seu@email.com" required value={formData.email} onChange={set('email')} />
          </div>
          <div className="input-group">
            <label htmlFor="reg-password">Senha</label>
            <input id="reg-password" className="input" type="password" placeholder="Mínimo 8 caracteres" required minLength={8} value={formData.password} onChange={set('password')} />
          </div>
          <div className="input-group">
            <label htmlFor="reg-confirm">Confirmar senha</label>
            <input id="reg-confirm" className="input" type="password" placeholder="Repita a senha" required value={formData.confirm} onChange={set('confirm')} />
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
            Ao criar conta, você concorda com nossa{' '}
            <Link href="/politica-de-privacidade" style={{ color: 'var(--color-gold)' }}>Política de Privacidade</Link>.
          </p>
          <button type="submit" className="btn btn-gold btn-lg auth-submit" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className="auth-footer-text">
          Já tem conta?{' '}
          <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="auth-link">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card">Carregando...</div></div>}>
      <RegistroContent />
    </Suspense>
  );
}
