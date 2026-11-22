'use client';

import { useCallback, useEffect, useState } from 'react';

interface BackupItem {
  id: string;
  nome: string;
  criado_por: string | null;
  tamanho_bytes: number;
  created_at: string;
}

function fmtData(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminBackups() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [nome, setNome] = useState('');
  const [trabalhando, setTrabalhando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backups', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setBackups(data.backups || []);
    } catch { /* lista indisponível */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  async function criar() {
    setTrabalhando(true);
    setErro('');
    setMsg('');
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao criar backup');
      setMsg(`Backup "${data.nome}" criado com sucesso (${fmtTamanho(data.tamanho_bytes)}).`);
      setNome('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar backup');
    } finally {
      setTrabalhando(false);
    }
  }

  async function restaurar(item: BackupItem) {
    const confirm1 = confirm(
      `Restore o backup "${item.nome}"?\n\nTODOS os conteúdos atuais do site (páginas, blocos, configurações, depoimentos, galeria, campanhas, produtos, leads, agendamentos e pedidos) serão SUBSTITUÍDOS pelos dados deste backup.`
    );
    if (!confirm1) return;
    const confirm2 = confirm('Última confirmação: deseja realmente substituir o conteúdo atual? Um backup do estado atual será criado automaticamente antes.');
    if (!confirm2) return;

    setRestaurando(item.id);
    setErro('');
    setMsg('');
    try {
      const res = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao restaurar');
      setMsg(`Backup "${item.nome}" restaurado: ${data.restaurado?.tabelas || 0} tabelas, ${data.restaurado?.linhas || 0} registros. Estado anterior salvo como backup automático.`);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao restaurar');
    } finally {
      setRestaurando(null);
    }
  }

  async function excluir(item: BackupItem) {
    if (!confirm(`Excluir o backup "${item.nome}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch('/api/admin/backups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    if (!res.ok) { setErro('Falha ao excluir backup'); return; }
    await carregar();
  }

  return (
    <>
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{ margin: 0 }}>💾 Content Backup & Restore</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0.5rem 0 0' }}>
          O backup captura o conteúdo administrável do site (páginas, blocos, configurações, depoimentos,
          galeria, campanhas, produtos, leads, agendamentos e pedidos). Restore <strong>substitui</strong>{' '}
          o conteúdo atual pelos dados do backup — um backup do estado atual é criado automaticamente antes.
        </p>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do backup (opcional) — ex: antes do lançamento"
            style={{ flex: 1, minWidth: 260 }}
          />
          <button type="button" className="btn btn-gold" onClick={criar} disabled={trabalhando}>
            {trabalhando ? 'Criando...' : '📸 Criar backup agora'}
          </button>
        </div>

        {msg && <p style={{ margin: '0.75rem 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>{msg}</p>}
        {erro && <p role="alert" style={{ margin: '0.75rem 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>{erro}</p>}
      </div>

      <div className="admin-card">
        <h4 style={{ margin: '0 0 0.75rem' }}>Saved Backups</h4>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Criado em</th>
                <th>Criado por</th>
                <th>Tamanho</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{b.nome}</td>
                  <td>{fmtData(b.created_at)}</td>
                  <td>{b.criado_por || '—'}</td>
                  <td>{fmtTamanho(b.tamanho_bytes)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary btn-sm" disabled={restaurando === b.id} onClick={() => restaurar(b)}>
                        {restaurando === b.id ? 'Restaurando...' : 'Restore'}
                      </button>
                      <a className="btn btn-ghost btn-sm" href={`/api/admin/backups/${b.id}/download`}>
                        Download
                      </a>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => excluir(b)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr><td colSpan={5} style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>Nenhum backup criado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}