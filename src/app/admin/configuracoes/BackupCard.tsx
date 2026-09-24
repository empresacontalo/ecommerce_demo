'use client';

import { useState } from 'react';

const IconeDisquete = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const IconeUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/**
 * Card "Backup e Restauração" em Admin > Configurações.
 * - 💾 Gera um backup (gzip) e baixa o arquivo.
 * - ⬆️ Restaura a partir de um arquivo comprimido (.backup.json.gz/.json)
 *   enviado ou de um link com a localização do arquivo.
 */
export default function BackupCard() {
  const [nome, setNome] = useState('');
  const [gerando, setGerando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  async function gerarEBaixar() {
    setGerando(true);
    setErro('');
    setMsg('');
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao gerar backup');
      setMsg(`Backup "${data.nome}" gerado (${new Date(data.created_at).toLocaleString('pt-BR')}). Iniciando download...`);
      window.location.href = `/api/admin/backups/${data.id}/download`;
      setNome('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar backup');
    } finally {
      setGerando(false);
    }
  }

  async function restaurar() {
    setTrabalhando(true);
    setErro('');
    setMsg('');
    try {
      let res: Response;
      if (arquivo) {
        const form = new FormData();
        form.append('arquivo', arquivo);
        form.append('confirmado', confirmado ? 'true' : 'false');
        res = await fetch('/api/admin/backups/import', { method: 'POST', body: form });
      } else if (link.trim()) {
        res = await fetch('/api/admin/backups/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link.trim(), confirmado }),
        });
      } else {
        setErro('Envie um arquivo ou informe o link do arquivo de backup.');
        setTrabalhando(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao restaurar');
      setMsg(`Backup restaurado: ${data.restaurado?.tabelas || 0} tabelas, ${data.restaurado?.linhas || 0} registros. Estado anterior salvo como backup automático.`);
      setArquivo(null);
      setLink('');
      setConfirmado(false);
      setPainelAberto(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao restaurar');
    } finally {
      setTrabalhando(false);
    }
  }

  return (
    <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(212,175,55,0.3)' }}>
      <h3 style={{ margin: 0 }}>💾 Backup e Restauração do Conteúdo</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0.5rem 0 0' }}>
        O backup comprime todo o conteúdo do site (páginas, blocos, configurações, depoimentos, galeria,
        campanhas, produtos, leads, agendamentos e pedidos) em gzip de alta compactação. A restauração
        substitui o conteúdo atual e cria automaticamente um backup do estado anterior.
      </p>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Gerar / baixar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 'var(--text-sm)' }}>Nome opcional do backup</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: antes do lançamento"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button type="button" className="btn btn-gold" onClick={gerarEBaixar} disabled={gerando} title="Gerar backup e baixar o arquivo comprimido">
              <IconeDisquete /> {gerando ? 'Gerando...' : 'Gerar e baixar'}
            </button>
          </div>
        </div>

        {/* Restaurar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 'var(--text-sm)' }}>Restaurar a partir de um backup</label>
          <button type="button" className="btn btn-primary" onClick={() => setPainelAberto(!painelAberto)} title="Restaurar conteúdo de um arquivo ou link">
            <IconeUpload /> {painelAberto ? 'Fechar restauração' : 'Restaurar backup'}
          </button>
        </div>
      </div>

      {painelAberto && (
        <div style={{ marginTop: '1rem', border: '1px solid var(--color-border, #333)', borderRadius: 8, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ fontSize: 'var(--text-sm)' }}>
            <strong>1. Arquivo (.backup.json.gz ou .json) enviado da sua máquina:</strong>
            <input
              type="file"
              accept=".gz,.json,application/gzip,application/json"
              className="input"
              style={{ marginTop: '0.25rem' }}
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)' }}><strong>ou</strong></span>
            <input
              className="input"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link com a localização do arquivo na VPS (http/https)"
              style={{ flex: 1, minWidth: 260 }}
            />
          </div>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            Entendo que a restauração <strong>substitui todo o conteúdo atual</strong> do site pelos dados do
            arquivo (um backup do estado atual será criado automaticamente).
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPainelAberto(false); setArquivo(null); setLink(''); setConfirmado(false); }}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={trabalhando || !confirmado} onClick={restaurar}>
              {trabalhando ? 'Restaurando...' : 'Restaurar agora'}
            </button>
          </div>
        </div>
      )}

      {msg && <p style={{ margin: '0.75rem 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>{msg}</p>}
      {erro && <p role="alert" style={{ margin: '0.75rem 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-error)' }}>{erro}</p>}

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: '0.75rem 0 0' }}>
        Histórico completo (restaurar um backup salvo, baixar ou excluir):{' '}
        <a href="/admin/backups" style={{ color: 'var(--color-gold)' }}>ver página de Backup →</a>
      </p>
    </div>
  );
}