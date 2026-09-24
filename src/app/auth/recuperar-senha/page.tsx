'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/auth/client';
import AuthLogo from '@/components/AuthLogo';

export default function RecuperarSenhaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/atualizar-senha`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthLogo />
        <h1 className="auth-title">Recuperar senha</h1>
        <p className="auth-subtitle">Enviaremos um link de recuperação para o seu e-mail</p>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && (
          <div className="auth-error" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }} role="alert">
            Link de recuperação enviado! Verifique sua caixa de entrada.
          </div>
        )}

        {!success ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="reset-email">E-mail</label>
              <input 
                id="reset-email" 
                className="input" 
                type="email" 
                placeholder="seu@email.com" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            
            <button type="submit" className="btn btn-gold btn-lg auth-submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </button>
          </form>
        ) : (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
             <button onClick={() => setSuccess(false)} className="btn btn-secondary btn-lg auth-submit">
              Tentar outro e-mail
            </button>
          </div>
        )}

        <p className="auth-footer-text">
          Lembrou a senha?{' '}
          <Link href="/auth/login" className="auth-link">Voltar ao Login</Link>
        </p>
      </div>
    </div>
  );
}
