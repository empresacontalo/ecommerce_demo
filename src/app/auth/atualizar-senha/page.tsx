'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLogo from '@/components/AuthLogo';

function AtualizarSenhaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao atualizar senha');
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/admin');
        }, 2000);
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <AuthLogo />
          <h1 className="auth-title">Link inválido</h1>
          <p className="auth-subtitle">O link de recuperação de senha é inválido ou expirou.</p>
          <p className="auth-footer-text">
            <a href="/auth/recuperar-senha" className="auth-link">Solicitar novo link</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthLogo />
        <h1 className="auth-title">Atualizar senha</h1>
        <p className="auth-subtitle">Digite sua nova senha abaixo</p>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && (
          <div className="auth-error" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }} role="alert">
            Senha atualizada com sucesso! Redirecionando...
          </div>
        )}

        {!success && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="upd-password">Nova Senha</label>
              <input
                id="upd-password"
                className="input"
                type="password"
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="upd-confirm">Confirmar Nova Senha</label>
              <input
                id="upd-confirm"
                className="input"
                type="password"
                placeholder="Repita a senha"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-gold btn-lg auth-submit" disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AtualizarSenhaPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card">Carregando...</div></div>}>
      <AtualizarSenhaContent />
    </Suspense>
  );
}
