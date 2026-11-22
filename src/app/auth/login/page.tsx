'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/auth/client';
import { getDraft, replayDraft, setDraftResult } from '@/utils/admin-draft';
import AuthLogo from '@/components/AuthLogo';

const DEMO_EMAIL = 'demo@aurafragrances.demo';
const DEMO_PASSWORD = 'DemoView2026!';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const sessionExpired = searchParams.get('reason') === 'session';
  const client = createClient();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Sessão havia expirado com um save pendente: reproduz o save com a
      // sessão renovada e volta para a mesma tela de edição.
      const draft = getDraft();
      if (draft) {
        const r = await replayDraft(draft);
        setDraftResult(r.ok);
      }
      const isDemo = email.trim().toLowerCase() === DEMO_EMAIL;
      const target = draft?.path || (isDemo && next === '/' ? '/admin' : next);
      router.push(target);
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    // Se houver save pendente, o alvo pós-OAuth é a tela de edição de origem;
    // o AdminLayout reproduz o draft ao montar.
    const draft = getDraft();
    const effectiveNext = draft?.path || next;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(effectiveNext)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <AuthLogo />
        </div>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to access your account or explore the Read-Only Admin Panel</p>

        <div
          style={{
            background: 'rgba(212, 175, 55, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: '10px',
            padding: '0.7rem 0.9rem',
            marginBottom: '1rem',
            fontSize: '0.82rem',
            color: '#f5d77f',
            lineHeight: 1.45,
          }}
        >
          <strong>👁️ Read-Only Demo Account Pre-Filled:</strong> Just click <strong>Sign In</strong> to inspect the Admin Panel safely (all modifications and secrets are blocked server-side).
        </div>

        {error && (
          <div className="auth-error" role="alert">{error}</div>
        )}

        {sessionExpired && (
          <div className="auth-warning" role="status">
            Your session expired. Any unsaved changes were preserved and will be saved automatically after signing in.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="auth-password">
              Password
              <Link href="/auth/recuperar-senha" className="auth-forgot">Forgot?</Link>
            </label>
            <input
              id="auth-password"
              className="input"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-gold btn-lg auth-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button
          type="button"
          className="btn btn-secondary btn-lg auth-social-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
          id="google-login-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="auth-footer-text">
          Don&apos;t have an account?{' '}
          <Link href={`/auth/registro${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="auth-link">Create account</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
