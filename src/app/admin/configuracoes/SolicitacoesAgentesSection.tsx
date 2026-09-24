'use client';

import { useEffect, useState } from 'react';

interface AgenteConfig {
  mcpUrl: string;
  agenteNome: string;
  tokenConfigurado: boolean;
}

const PLACEHOLDER_TOKEN = '••••••••••••••••••••••••••••••';

/**
 * Card "Solicitações aos Agentes" em Admin > Configurações:
 * URL do MCP, nome do agente e token de acesso (secreto).
 * O token atual NUNCA chega ao navegador: só mostra se existe
 * configurado e, para trocá-lo, basta digitar o novo valor — ao
 * salvar, o anterior é substituído. Vazio mantém o atual.
 */
export default function SolicitacoesAgentesSection() {
  const [cfg, setCfg] = useState<AgenteConfig>({ mcpUrl: '', agenteNome: '', tokenConfigurado: false });
  const [tokenNovo, setTokenNovo] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/agente', { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          setCfg({ mcpUrl: d.mcpUrl || '', agenteNome: d.agenteNome || '', tokenConfigurado: d.tokenConfigurado === true });
        }
      } catch { /* mantém vazio */ }
    })();
  }, []);

  const tokenTrocando = tokenNovo.trim().length > 0;

  const salvar = async () => {
    if (!cfg.mcpUrl.trim()) { setErro('Informe a URL do servidor MCP.'); return; }
    if (!cfg.agenteNome.trim()) { setErro('Informe o nome do agente.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/agente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mcpUrl: cfg.mcpUrl.trim(),
          agenteNome: cfg.agenteNome.trim(),
          // Só sobrescreve o token se o admin digitou um novo; vazio mantém o atual.
          mcpToken: tokenNovo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar');
      setTokenNovo('');
      setCfg(prev => ({ ...prev, tokenConfigurado: data.tokenConfigurado === true }));
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{ margin: 0 }}>🤖 Solicitações aos Agentes</h3>
        {salvo && <span className="badge badge-success">✅ Salvo!</span>}
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
        Conexão usada para solicitar ao agente de atendimento (ex: informar rastreio e acompanhamento de pedidos
        ao cliente pelo WhatsApp). O <strong>token é secreto</strong>: não é possível visualizá-lo nem copiá-lo —
        para trocá-lo, basta digitar o novo valor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <div className="input-group">
          <label>URL do servidor MCP (agente)</label>
          <input
            className="input"
            type="url"
            placeholder="https://agente.seudominio.com/api/v1/mcp"
            value={cfg.mcpUrl}
            onChange={e => setCfg(prev => ({ ...prev, mcpUrl: e.target.value }))}
          />
        </div>
        <div className="input-group">
          <label>Nome do agente</label>
          <input
            className="input"
            placeholder="fragrance_sales_agent"
            value={cfg.agenteNome}
            onChange={e => setCfg(prev => ({ ...prev, agenteNome: e.target.value }))}
          />
        </div>
        <div className="input-group">
          <label>Token de acesso (secreto)</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            style={{ userSelect: 'none' }}
            placeholder={cfg.tokenConfigurado ? PLACEHOLDER_TOKEN : 'Token ainda não configurado'}
            value={tokenNovo}
            onChange={e => setTokenNovo(e.target.value)}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {cfg.tokenConfigurado
              ? (tokenTrocando
                  ? 'Atenção: um novo valor será salvo e o token atual será substituído.'
                  : 'Token configurado. Deixe vazio para manter (não é exibido nem copiável).')
              : 'Configure o token para ativar as solicitações ao agente.'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
        {erro && <span style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{erro}</span>}
        <button type="button" onClick={salvar} disabled={salvando} className="btn btn-gold btn-lg">
          {salvando ? 'Salvando...' : '💾 Salvar Conexão'}
        </button>
      </div>
    </div>
  );
}