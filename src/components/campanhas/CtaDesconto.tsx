'use client';

import { useState } from 'react';

interface Props {
  leadId: string;
  mensagem?: string;
  campanhaTitulo?: string;
}

// Após captura do lead, oferece o canal para receber a mensagem personalizada
export default function CtaDesconto({ leadId, mensagem, campanhaTitulo }: Props) {
  const [canal, setCanal] = useState<'whatsapp' | 'chat' | 'email'>('whatsapp');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ acao?: string | null; mensagem: string; canal: string } | null>(null);
  const [error, setError] = useState('');

  const enviar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/campanhas/desconto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, canal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Erro ao enviar mensagem.');
        return;
      }
      setResultado(data);
      if (data.canal === 'whatsapp' && data.acao) {
        window.open(data.acao, '_blank', 'noopener');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (resultado) {
    return (
      <div className="campanha-sucesso" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h3>{campanhaTitulo || 'Mensagem enviada!'}</h3>
        <p className="subtitle">{resultado.mensagem}</p>
        {resultado.canal === 'whatsapp' && resultado.acao && (
          <a href={resultado.acao} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
            Abrir WhatsApp
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="campanha-cta" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      {mensagem && <p className="subtitle">{mensagem}</p>}
      <p style={{ marginBottom: '1rem' }}>Escolha seu canal preferido para receber o desconto:</p>
      <div className="campanha-opcoes campanha-opcoes-cta">
        {([['whatsapp', '💬 WhatsApp'], ['chat', '🖥️ Chat'], ['email', '✉️ E-mail']] as const).map(([v, label]) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="radio" name="canal-cta" checked={canal === v} onChange={() => setCanal(v)} />
            {label}
          </label>
        ))}
      </div>
      {error && <p style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.875rem' }}>{error}</p>}
      <button className="btn btn-gold btn-lg campanha-cta-botao" onClick={enviar} disabled={loading}>
        {loading ? 'Enviando...' : '🎁 Quero receber meu desconto sem compromisso'}
      </button>
    </div>
  );
}
