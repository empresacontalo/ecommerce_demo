'use client';

import { useCallback, useEffect, useState } from 'react';

interface AuditItem {
  id: string;
  responsavel_tipo: 'admin' | 'mcp';
  responsavel_nome: string;
  acao: string;
  resumo: string;
  detalhe: string;
  ip: string | null;
  navegador: string | null;
  sistema_operacional: string | null;
  localizacao: string | null;
  criado_em: string;
}

interface AuditResponse {
  itens: AuditItem[];
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
  filtros: { acoes: string[]; responsaveis: string[] };
}

const ACAO_ROTULO: Record<string, string> = {
  configuracao: 'Configuração',
  produto: 'Produto',
  usuario: 'Administradores',
  token_mcp: 'Tokens de IA',
  conteudo: 'Conteúdo',
  pagina: 'Páginas',
  depoimento: 'Depoimentos',
  galeria: 'Galeria',
  campanha: 'Campanhas',
  trafego_pago: 'Tráfego Pago',
  lead: 'Leads',
  agendamento: 'Agendamentos',
  pedido: 'Pedidos',
  limites: 'Limites de acesso',
  ambiente: 'Ambiente',
  backup: 'Backup',
  venda: 'Venda',
};

function rotuloAcao(acao: string): string {
  return ACAO_ROTULO[acao] || acao;
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminAuditoria() {
  const [itens, setItens] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [acoes, setAcoes] = useState<string[]>([]);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  const [q, setQ] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [filtroDe, setFiltroDe] = useState('');
  const [filtroAte, setFiltroAte] = useState('');

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState<AuditItem | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        por_pagina: String(porPagina),
      });
      if (q) params.set('q', q);
      if (filtroResponsavel) params.set('responsavel', filtroResponsavel);
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroAcao) params.set('acao', filtroAcao);
      if (filtroDe) params.set('de', filtroDe);
      if (filtroAte) params.set('ate', filtroAte);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuditResponse = await res.json();
      setItens(data.itens);
      setTotal(data.total);
      setTotalPaginas(data.total_paginas);
      setAcoes(data.filtros.acoes);
      setResponsaveis(data.filtros.responsaveis);
    } catch (e: unknown) {
      console.error('Erro ao carregar auditoria:', e);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  }, [pagina, porPagina, q, filtroResponsavel, filtroTipo, filtroAcao, filtroDe, filtroAte]);

  useEffect(() => {
    // carregar() faz setState no corpo (loading/erro) — mesmo padrão das demais
    // páginas admin do projeto; o fetch em si é assíncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setPagina(1);
    carregar();
  }

  function limpar() {
    setQ('');
    setFiltroResponsavel('');
    setFiltroTipo('');
    setFiltroAcao('');
    setFiltroDe('');
    setFiltroAte('');
    setPagina(1);
  }

  function mudarPorPagina(n: number) {
    setPorPagina(n);
    setPagina(1);
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2>Audit Logs</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Registro de alterações feitas por administradores e pela inteligência artificial (MCP).
            Logs são mantidos por 7 dias.
          </p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <form onSubmit={buscar} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <label className="label">Search (summary, IP, location)</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g., product, 177.55..." />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ minWidth: 130 }}>
              <option value="">All</option>
              <option value="admin">Administrador</option>
              <option value="mcp">Inteligência Artificial</option>
            </select>
          </div>
          <div>
            <label className="label">Actor</label>
            <select className="input" value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">All</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Action Type</label>
            <select className="input" value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">All</option>
              {acoes.map((a) => (
                <option key={a} value={a}>{rotuloAcao(a)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input className="input" type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input" type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Search</button>
          <button type="button" className="btn btn-ghost" onClick={limpar}>Clear</button>
        </form>
      </div>

      {erro && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-lg)' }}>
          {erro}
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>Loading...</div>
        ) : itens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
            No audit records found matching the current filters.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Actor</th>
                  <th>Tipo</th>
                  <th>Summary</th>
                  <th>IP</th>
                  <th>Navegador</th>
                  <th>Sistema</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{formatarData(item.criado_em)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong>{item.responsavel_nome}</strong>
                      <div>
                        <span
                          className={`badge ${item.responsavel_tipo === 'mcp' ? 'badge-purple' : 'badge-info'}`}
                          style={{ fontSize: 'var(--text-xs)' }}
                        >
                          {item.responsavel_tipo === 'mcp' ? 'IA (MCP)' : 'Administrador'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary">{rotuloAcao(item.acao)}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => setDetalhe(item)}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline', fontSize: 'inherit' }}
                        title="Clique para ver o detalhe por extenso"
                      >
                        {item.resumo}
                      </button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
                      {item.ip || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{item.navegador || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{item.sistema_operacional || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{item.localizacao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Por página:</span>
            <select
              className="input"
              value={porPagina}
              onChange={(e) => mudarPorPagina(Number(e.target.value))}
              style={{ width: 'auto', padding: '6px 10px' }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            {total === 0 ? '0 registros' : `${(pagina - 1) * porPagina + 1}–${Math.min(pagina * porPagina, total)} de ${total} registros`}
          </span>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button className="btn btn-ghost" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
              ← Anterior
            </button>
            <span style={{ alignSelf: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Página {pagina} de {totalPaginas}
            </span>
            <button className="btn btn-ghost" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
              Próxima →
            </button>
          </div>
        </div>
      </div>

      {detalhe && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Change Details</h3>
              <button className="modal-close" onClick={() => setDetalhe(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                <div><strong style={{ color: 'var(--color-text)' }}>{detalhe.resumo}</strong></div>
                <div style={{ marginTop: '4px' }}>
                  <span className={`badge ${detalhe.responsavel_tipo === 'mcp' ? 'badge-purple' : 'badge-info'}`}>
                    {detalhe.responsavel_tipo === 'mcp' ? 'Inteligência Artificial (MCP)' : 'Administrador'}
                  </span>{' '}
                  <span className="badge badge-secondary">{rotuloAcao(detalhe.acao)}</span>
                </div>
              </div>
              <p style={{ lineHeight: 1.6, margin: '0 0 var(--spacing-lg)' }}>{detalhe.detalhe}</p>
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--spacing-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
                <span>Responsável:</span><span>{detalhe.responsavel_nome}</span>
                <span>Data e hora:</span><span>{formatarData(detalhe.criado_em)}</span>
                <span>IP:</span><span style={{ fontFamily: 'monospace' }}>{detalhe.ip || '—'}</span>
                <span>Navegador:</span><span>{detalhe.navegador || '—'}</span>
                <span>Sistema:</span><span>{detalhe.sistema_operacional || '—'}</span>
                <span>Localização:</span><span>{detalhe.localizacao || '—'}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setDetalhe(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}