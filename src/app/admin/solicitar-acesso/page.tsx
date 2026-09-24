'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/auth/client';
import AuthLogo from '@/components/AuthLogo';

export default function SolicitarAcessoPage() {
  const router = useRouter();
  const supabase = createClient();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setError('');
    
    // 1. Criar o usuário no Auth
    // O backend (POST /api/auth/register) cria o registro em admin_users
    // com status 'pending' quando is_admin_request=true
    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.name,
          is_admin_request: true
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: '500px', textAlign: 'center' }}>
          <AuthLogo />
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>⏳</div>
          <h1 className="auth-title">Solicitação Enviada!</h1>
          <p className="auth-subtitle">
            Sua conta foi criada com sucesso, mas o acesso ao painel ainda está <strong>pendente</strong>.
          </p>
          <div style={{ background: 'rgba(255, 191, 0, 0.1)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md)', color: 'var(--color-gold)', marginBottom: 'var(--spacing-xl)', fontSize: 'var(--text-sm)' }}>
            Um administrador pré-aprovado precisa autorizar seu perfil antes que você possa entrar.
          </div>
          <Link href="/auth/login" className="btn btn-gold btn-lg" style={{ width: '100%' }}>
            Voltar ao Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <AuthLogo />
        <h1 className="auth-title">Solicitar Acesso Admin</h1>
        <p className="auth-subtitle">Cadastre-se para solicitar permissões de administrador.</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nome Completo</label>
            <input 
              className="input" 
              type="text" 
              placeholder="Seu nome" 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          
          <div className="input-group">
            <label>E-mail Corporativo</label>
            <input 
              className="input" 
              type="email" 
              placeholder="seu@email.com" 
              required 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>

          <div className="input-group">
            <label>Senha</label>
            <input 
              className="input" 
              type="password" 
              placeholder="Mínimo 8 caracteres" 
              required 
              minLength={8} 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
            />
          </div>

          <div className="input-group">
            <label>Confirmar Senha</label>
            <input 
              className="input" 
              type="password" 
              placeholder="Repita a senha" 
              required 
              value={formData.confirm} 
              onChange={e => setFormData({...formData, confirm: e.target.value})} 
            />
          </div>

          <button type="submit" className="btn btn-gold btn-lg auth-submit" disabled={loading}>
            {loading ? 'Processando...' : 'Solicitar Acesso'}
          </button>
        </form>

        <p className="auth-footer-text">
          Já tem acesso? <Link href="/auth/login" className="auth-link">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
