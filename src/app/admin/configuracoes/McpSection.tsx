'use client';

import { useCallback, useEffect, useState } from 'react';

interface TokenItem {
  id: string;
  nome: string;
  created_at: string;
  expires_at: string | null;
  blocked: boolean;
  last_used_at: string | null;
  ultimos4: string | null;
  escopo?: 'admin' | 'vendas';
}

const DURACOES = [
  { valor: '1m', label: '1 mês' },
  { valor: '3m', label: '3 meses' },
  { valor: '12m', label: '12 meses' },
  { valor: 'never', label: 'Nunca' },
];

function fmtData(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mascaraToken(token: string): string {
  return `••••••••••••••••••••••••••••${token}`;
}

/**
 * Card MCP em Admin > Configurações:
 * - Orientações de conexão da IA ao painel (/api/mcp)
 * - Gestão de tokens: emitir (descrição + duração), listar mascarado,
 *   copiar, bloquear/desbloquear e excluir.
 */
export default function McpSection() {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [nome, setNome] = useState('');
  const [duracao, setDuracao] = useState('12m');
  const [escopo, setEscopo] = useState<'admin' | 'vendas'>('admin');
  const [criado, setCriado] = useState<{ id: string; token: string; nome: string } | null>(null);
  const [copiado, setCopiado] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState('');
  const [trabalhando, setTrabalhando] = useState(false);

  const SITE = (typeof window !== 'undefined' && window.location.origin) || 'https://portalgerenciavel.digitalarea.online';
  const URL_MCP = `${SITE}/api/mcp`;

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mcp-tokens', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch { /* lista indisponível */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro('Informe para quem/quem é o token (descrição).'); return; }
    setTrabalhando(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), duracao, escopo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao emitir token');
      setCriado({ id: data.id, token: data.token, nome: data.nome });
      setNome('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao emitir token');
    } finally {
      setTrabalhando(false);
    }
  }

  async function copiar(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado((c) => ({ ...c, [id]: true }));
      setTimeout(() => setCopiado((c) => ({ ...c, [id]: false })), 2000);
    } catch { /* clipboard indisponível */ }
  }

  async function copiarToken(id: string) {
    try {
      const res = await fetch('/api/admin/mcp-tokens/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao recuperar token');
      await copiar(id, data.token);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao copiar token');
    }
  }

  async function bloquear(item: TokenItem) {
    const novo = !item.blocked;
    const res = await fetch('/api/admin/mcp-tokens', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, blocked: novo }),
    });
    if (!res.ok) { setErro('Falha ao alterar status'); return; }
    await carregar();
  }

  async function excluir(item: TokenItem) {
    if (!confirm(`Excluir o token "${item.nome}"? A conexão da IA com ele deixará de funcionar.`)) return;
    const res = await fetch('/api/admin/mcp-tokens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    if (!res.ok) { setErro('Falha ao excluir token'); return; }
    await carregar();
  }

  function status(item: TokenItem): { label: string; classe: string } {
    if (item.blocked) return { label: 'Bloqueado', classe: 'badge-error' };
    if (item.expires_at && new Date(item.expires_at) < new Date()) return { label: 'Expirado', classe: 'badge-warning' };
    return { label: 'Ativo', classe: 'badge-success' };
  }

  return (
    <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
      <h3 style={{ margin: 0 }}>🤖 MCP — Conectar IA ao painel</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0.5rem 0 0' }}>
        Endpoint: <code>{URL_MCP}</code> — autenticação: <code>Authorization: Bearer &lt;token&gt;</code>
      </p>

      <details style={{ marginTop: '1rem', border: '1px solid var(--color-border, #333)', borderRadius: 8, padding: '0.75rem 1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-gold)' }}>
          📖 Como conectar a inteligência artificial ao painel
        </summary>
        <div style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0 }}>
            O MCP permite que uma IA (Claude, Cursor, agente customizado) <strong>leia e altere</strong> o mesmo
            conteúdo do painel: páginas, blocos, configurações, depoimentos, galeria, campanhas, produtos,
            leads, agendamentos, pedidos e usuários admin. Segredos de ambiente nunca são retornados.
          </p>
          <div>
            <strong>Claude (CLI):</strong>
            <pre style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 8, overflowX: 'auto', fontSize: 'var(--text-xs)' }}>{`claude mcp add --transport http portal-admin \\
  -u ${URL_MCP} \\
  -H "Authorization: Bearer SEU_TOKEN"`}</pre>
          </div>
          <div>
            <strong>Claude Desktop (claude_desktop_config.json):</strong>
            <pre style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 8, overflowX: 'auto', fontSize: 'var(--text-xs)' }}>{`{
  "mcpServers": {
    "portal-admin": {
      "type": "http",
      "url": "${URL_MCP}",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}`}</pre>
          </div>
          <div>
            <strong>Teste rápido (curl):</strong>
            <pre style={{ background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 8, overflowX: 'auto', fontSize: 'var(--text-xs)' }}>{`curl -sS -X POST ${URL_MCP} \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}</pre>
          </div>
          <p style={{ margin: 0 }}>
            Quem possui um token tem o mesmo poder do painel — mantenha-os em sigilo, bloqueie ou exclua
            quando não forem mais necessários. O token é exibido <strong>uma única vez</strong> na emissão;
            na lista ele fica mascarado.
          </p>
        </div>
      </details>

      {/* ── Emissão ── */}
      <form onSubmit={emitir} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h4 style={{ margin: 0 }}>Emitir novo token</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--spacing-md)' }}>
          <div className="input-group">
            <label htmlFor="mcp-token-nome">Descrição (para quem foi gerado) *</label>
            <input
              id="mcp-token-nome"
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Claude do Bruno, Cursor da loja, Bot de suporte"
            />
          </div>
          <div className="input-group">
            <label htmlFor="mcp-token-duracao">Tempo de duração</label>
            <select id="mcp-token-duracao" className="input" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
              {DURACOES.map((d) => <option key={d.valor} value={d.valor}>{d.label}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="mcp-token-escopo">Tipo de acesso</label>
            <select id="mcp-token-escopo" className="input" value={escopo} onChange={(e) => setEscopo(e.target.value as 'admin' | 'vendas')}>
              <option value="admin">Admin — consulta, venda e alteração total</option>
              <option value="vendas">Vendas — consultas e realizar vendas (não altera conteúdo)</option>
            </select>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              <strong>Vendas</strong>: consulta produtos/pedidos, registra cliente/endereço, calcula frete, realiza venda e baixa de estoque.
              <strong> Admin</strong>: tudo isso + alterar páginas, carrossel, WhatsApp, Chatwoot, conteúdo e demais dados.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-gold" disabled={trabalhando}>
            {trabalhando ? 'Emitindo...' : '🎲 Emitir token'}
          </button>
          {criado && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 'var(--text-xs)', background: 'var(--color-surface)', padding: '0.5rem', borderRadius: 6 }}>{criado.token}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiar(criado.id, criado.token)}>
                {copiado[criado.id] ? 'Copiado!' : 'Copiar'}
              </button>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gold)' }}>Copie agora — não será exibido novamente.</span>
            </div>
          )}
        </div>
      </form>

      {erro && <p role="alert" style={{ margin: '0.75rem 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>{erro}</p>}

      {/* ── Lista de tokens ── */}
      <div style={{ marginTop: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.5rem' }}>Tokens emitidos</h4>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Emitido em</th>
                <th>Expira em</th>
                <th>Último uso</th>
                <th>Token</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => {
                const st = status(t);
                return (
                  <tr key={t.id}>
                    <td>{t.nome}</td>
                    <td>{fmtData(t.created_at)}</td>
                    <td>{fmtData(t.expires_at)}</td>
                    <td>{fmtData(t.last_used_at)}</td>
                    <td>
                      <code style={{ fontSize: 'var(--text-xs)' }}>{mascaraToken(t.ultimos4 || '')}</code>
                    </td>
                    <td>
                      <span className={`badge ${t.escopo === 'vendas' ? 'badge-info' : 'badge-gold'}`}>
                        {t.escopo === 'vendas' ? 'Vendas' : 'Admin'}
                      </span>
                    </td>
                    <td><span className={`badge ${st.classe}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copiarToken(t.id)}>
                          {copiado[t.id] ? 'Copiado!' : 'Copiar'}
                        </button>
                        <button type="button" className={`btn btn-ghost btn-sm ${t.blocked ? '' : ''}`} onClick={() => bloquear(t)}>
                          {t.blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => excluir(t)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 && (
                <tr><td colSpan={8} style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>Nenhum token emitido ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: '0.5rem 0 0' }}>
          A chave mestre <code>MCP_ADMIN_TOKEN</code> (variável de ambiente) continua funcionando como fallback
          de bootstrap junto aos tokens da lista acima.
        </p>
      </div>
    </div>
  );
}