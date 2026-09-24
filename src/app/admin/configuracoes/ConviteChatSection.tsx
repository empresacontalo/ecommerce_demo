'use client';

import { useState, useEffect } from 'react';
import {
  FLUTUANTE_DEFAULTS,
  configFlutuanteParaValor,
  normalizarConfigFlutuante,
  type FlutuanteConfig,
} from '@/utils/flutuante-config';

/**
 * Card "Convite ao chat e redes" em Admin > Configurações:
 * ativa/desativa a mensagem flutuante, personaliza texto e ícone,
 * e define quanto tempo ela fica visível (0 = ilimitado).
 */
export default function ConviteChatSection() {
  const [cfg, setCfg] = useState<FlutuanteConfig>({ ...FLUTUANTE_DEFAULTS });
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/cms/configuracoes?chave=flutuante');
        if (r.ok) {
          const { valor } = await r.json();
          if (valor) setCfg(normalizarConfigFlutuante(valor));
        }
      } catch { /* mantém padrão */ }
    })();
  }, []);

  const salvar = async () => {
    if (!cfg.texto.trim()) { setErro('Informe o texto do convite.'); return; }
    if (!cfg.icone.trim()) { setErro('Informe o ícone do convite.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/cms/configuracoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'flutuante',
          valor: configFlutuanteParaValor(cfg),
          descricao: 'Convite flutuante ao chat e redes (texto, ícone, duração e ativar/desativar)',
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      setErro('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{ margin: 0 }}>💬 Convite ao chat e redes</h3>
        {salvo && <span className="badge badge-success">✅ Salvo!</span>}
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
        Mensagem flutuante que aparece junto aos botões de chat e WhatsApp. Desative quando quiser, personalize o
        texto/ícone e defina por quanto tempo ela fica visível.
      </p>

      {/* Ativar/desativar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <button
          type="button"
          onClick={() => setCfg(prev => ({ ...prev, ativo: !prev.ativo }))}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
            border: `2px solid ${cfg.ativo ? 'var(--color-gold)' : 'var(--color-border)'}`,
            background: cfg.ativo ? 'rgba(212,175,55,0.15)' : 'transparent',
            color: 'var(--color-text)',
          }}
        >
          {cfg.ativo ? '✅ Ativo' : '⛔ Desativado'}
        </button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {cfg.ativo ? 'O convite está visível no site.' : 'O convite não aparece no site.'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>Texto do convite</label>
          <textarea
            className="input"
            rows={2}
            value={cfg.texto}
            onChange={e => setCfg(prev => ({ ...prev, texto: e.target.value }))}
            placeholder={FLUTUANTE_DEFAULTS.texto}
          />
        </div>
        <div className="input-group">
          <label>Ícone (emoji)</label>
          <input
            className="input"
            value={cfg.icone}
            maxLength={8}
            onChange={e => setCfg(prev => ({ ...prev, icone: e.target.value }))}
            placeholder={FLUTUANTE_DEFAULTS.icone}
          />
        </div>
        <div className="input-group">
          <label>Tempo visível (segundos) — 0 = permanece até fechar</label>
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            value={cfg.duracao_s}
            onChange={e => setCfg(prev => ({ ...prev, duracao_s: Number(e.target.value) }))}
          />
        </div>
        <div className="input-group">
          <label>Atraso até aparecer (milissegundos)</label>
          <input
            className="input"
            type="number"
            min={0}
            step={500}
            value={cfg.atraso_ms}
            onChange={e => setCfg(prev => ({ ...prev, atraso_ms: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
        {erro && <span style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{erro}</span>}
        <button type="button" onClick={salvar} disabled={salvando} className="btn btn-gold btn-lg">
          {salvando ? 'Salvando...' : '💾 Salvar Convite'}
        </button>
      </div>
    </div>
  );
}