'use client';

import { useState } from 'react';
import { abrirChatComMensagem } from '@/components/ChatWidget';

interface Familiar {
  nome: string;
  whatsapp: string;
  data_especial: string;
}

export interface LeadFormData {
  campanha_id: string;
  nome: string;
  whatsapp: string;
  email: string;
  nascimento: string;
  data_especial: string;
  preferencia_lembrete: 'mim' | 'outros' | 'ambos';
  canal_preferido: 'whatsapp' | 'chat' | 'email';
  familiares: Familiar[];
}

interface Props {
  campanhaId: string;
  campanhaTitulo?: string;
  mensagem?: string;
  formTitulo?: string;
  onCapturado: (leadId: string) => void;
}

const fmtTel = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '1rem',
};

// Bloco promocional: mensagem da campanha + formulário de captura de dados
export default function BlocoPromocional({ campanhaId, campanhaTitulo, mensagem, formTitulo, onCapturado }: Props) {
  const [fd, setFd] = useState<LeadFormData>({
    campanha_id: campanhaId,
    nome: '',
    whatsapp: '',
    email: '',
    nascimento: '',
    data_especial: '',
    preferencia_lembrete: 'mim',
    canal_preferido: 'whatsapp',
    familiares: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof LeadFormData>(k: K, v: LeadFormData[K]) => setFd((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/campanhas/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fd),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Erro ao enviar. Tente novamente.');
        return;
      }
      onCapturado(data.lead_id);

      // Abre o chat automaticamente e envia uma mensagem com TODOS os dados
      // do cliente + a campanha, para a atendente já atender sem consultar nada.
      const campanha = campanhaTitulo || 'desconto da campanha';
      const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : 'não informado';
      const lembrete = fd.preferencia_lembrete === 'ambos' ? 'A mim e a outras pessoas' : 'Apenas a mim';
      const canalLabel = fd.canal_preferido === 'whatsapp' ? 'WhatsApp' : fd.canal_preferido === 'chat' ? 'Chat do site' : 'E-mail';
      const familiaresComDados = fd.familiares.filter(f => f.nome);
      const familiaresTexto = familiaresComDados.length
        ? '\n👨‍👩‍👧 Convidados:\n' + familiaresComDados.map(f =>
            `  • ${f.nome}${f.whatsapp ? ` | WhatsApp: ${f.whatsapp}` : ''}${f.data_especial ? ` | Data especial: ${fmtData(f.data_especial)}` : ''}`
          ).join('\n')
        : '';
      await abrirChatComMensagem({
        nome: fd.nome || 'Visitante',
        mensagem: `Olá! Gostaria de receber o desconto da campanha "${campanha}". 🎁\n\n📋 Meus dados:\n👤 Nome: ${fd.nome}\n📱 WhatsApp: ${fd.whatsapp || 'não informado'}\n✉️ E-mail: ${fd.email || 'não informado'}\n🎂 Nascimento: ${fmtData(fd.nascimento)}\n📅 Data especial: ${fmtData(fd.data_especial)}\n🔔 Lembretes para: ${lembrete}\n💬 Canal preferido: ${canalLabel}${familiaresTexto}\n\nJá deixo meus dados completos para agilizar o atendimento.`,
      });
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const atualizarFamiliar = (i: number, k: keyof Familiar, v: string) => {
    setFd((p) => ({
      ...p,
      familiares: p.familiares.map((f, j) => (j === i ? { ...f, [k]: v } : f)),
    }));
  };

  return (
    <section className="section lead-section campanha-promocional">
      <div className="container">
        <div className="lead-grid">
          <div className="lead-info reveal">
            <h2>{formTitulo || 'Quero receber meu desconto sem compromisso'}</h2>
            {mensagem && <p>{mensagem}</p>}
            <div className="lead-benefits">
              <div className="lead-benefit"><div className="lead-benefit-icon">🎁</div><span>Desconto exclusivo na sua compra</span></div>
              <div className="lead-benefit"><div className="lead-benefit-icon">🗓️</div><span>Lembretes de datas especiais</span></div>
              <div className="lead-benefit"><div className="lead-benefit-icon">💬</div><span>Atendimento pelo seu canal preferido</span></div>
            </div>
          </div>
          <div className="lead-form-card reveal" style={{ animationDelay: '200ms' }}>
            <h3>Cadastre-se para participar</h3>
            <form className="lead-form" onSubmit={submit}>
              <div className="input-group">
                <label htmlFor="cp-nome">Nome completo *</label>
                <input id="cp-nome" className="input" style={inputStyle} required value={fd.nome} onChange={(e) => set('nome', e.target.value)} />
              </div>
              <div className="input-group">
                <label htmlFor="cp-whatsapp">Melhor WhatsApp/telefone</label>
                <input id="cp-whatsapp" className="input" style={inputStyle} type="tel" value={fd.whatsapp} onChange={(e) => set('whatsapp', fmtTel(e.target.value))} />
              </div>
              <div className="input-group">
                <label htmlFor="cp-email">Melhor e-mail</label>
                <input id="cp-email" className="input" style={inputStyle} type="email" value={fd.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="campanha-form-row">
                <div className="input-group">
                  <label htmlFor="cp-nascimento">Data de nascimento</label>
                  <input id="cp-nascimento" className="input" style={inputStyle} type="date" value={fd.nascimento} onChange={(e) => set('nascimento', e.target.value)} />
                </div>
                <div className="input-group">
                  <label htmlFor="cp-data-especial">Data especial/compromisso</label>
                  <input id="cp-data-especial" className="input" style={inputStyle} type="date" value={fd.data_especial} onChange={(e) => set('data_especial', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label>Quem deve receber os lembretes?</label>
                <div className="campanha-opcoes">
                  {([['mim', 'Lembrar a mim'], ['ambos', 'A mim e outras pessoas']] as const).map(([v, label]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                      <input type="radio" name="preferencia" checked={fd.preferencia_lembrete === v} onChange={() => set('preferencia_lembrete', v)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Deseja convidar alguém para fazer parte do seu grupo familiar?</label>
                {fd.familiares.map((f, i) => (
                  <div key={i} className="campanha-familiar">
                    <input className="input" style={inputStyle} placeholder="Nome" value={f.nome} onChange={(e) => atualizarFamiliar(i, 'nome', e.target.value)} />
                    <input className="input" style={inputStyle} placeholder="WhatsApp" type="tel" value={f.whatsapp} onChange={(e) => atualizarFamiliar(i, 'whatsapp', fmtTel(e.target.value))} />
                    <input className="input campanha-familiar-data" style={inputStyle} type="date" value={f.data_especial} onChange={(e) => atualizarFamiliar(i, 'data_especial', e.target.value)} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('familiares', fd.familiares.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => set('familiares', [...fd.familiares, { nome: '', whatsapp: '', data_especial: '' }])}
                >
                  + Convidar pessoa
                </button>
              </div>
              <div className="input-group">
                <label>Canal preferido de comunicação</label>
                <div className="campanha-opcoes">
                  {([['whatsapp', '💬 WhatsApp'], ['chat', '🖥️ Chat do site'], ['email', '✉️ E-mail']] as const).map(([v, label]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                      <input type="radio" name="canal" checked={fd.canal_preferido === v} onChange={() => set('canal_preferido', v)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {error && <p style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.875rem' }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-gold btn-lg" style={{ width: '100%' }}>
                {loading ? 'Enviando...' : 'QUERO RECEBER MEU DESCONTO'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
