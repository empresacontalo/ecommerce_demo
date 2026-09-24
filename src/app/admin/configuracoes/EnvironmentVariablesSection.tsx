'use client';

import { useEffect, useRef, useState } from 'react';

interface VariableItem {
  key: string;
  description: string;
  scope: string;
  service: string;
  sensitive: boolean;
  buildTime?: boolean;
  editable: boolean;
  impact: string;
  configured: boolean | null;
  source: string;
  drift: boolean | null;
  howTo?: string;
}

interface Preview {
  requestId: string;
  confirmationToken: string;
  expectedRevision: string;
  impact: string;
  diff: { keys?: Record<string, { sensitive: boolean; value?: string; impact: string; scope: string }> };
}

interface Operation {
  id?: string;
  status: string;
  impact: string;
  error_code?: string | null;
  updated_at?: string;
}

const IMPACT_LABEL: Record<string, string> = {
  local_projection: 'Arquivo local',
  stack_redeploy: 'Reinicia o app',
  image_rebuild: 'Reconstrói a imagem e reinicia',
  database_rotation: 'Operação crítica de banco',
};

const SCOPE_LABEL: Record<string, string> = {
  'app-runtime': 'Runtime do app',
  database: 'Banco de dados',
  build: 'Build público',
  derived: 'Derivada do Compose',
  'local-only': 'Somente local',
};

const TERMINAL = new Set(['healthy', 'failed', 'rolled_back', 'cancelled']);

export default function EnvironmentVariablesSection() {
  const [variables, setVariables] = useState<VariableItem[]>([]);
  const [controllerAvailable, setControllerAvailable] = useState(false);
  const [revision, setRevision] = useState<string>('initial');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const helpPanelRef = useRef<HTMLDetailsElement>(null);
  const helpTargetRef = useRef<Record<string, HTMLDivElement | null>>({});

  const openHowTo = (key: string) => {
    if (!helpPanelRef.current) return;
    helpPanelRef.current.open = true;
    setTimeout(() => {
      helpTargetRef.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/environment', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar o ambiente');
      setVariables(data.variables || []);
      setControllerAvailable(data.controllerAvailable === true);
      setRevision(data.revision?.id || 'initial');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar variáveis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, []);

  const previewChanges = async () => {
    const patch = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== ''));
    if (Object.keys(patch).length === 0) {
      setError('Informe pelo menos uma alteração. Para segredos, vazio mantém o valor atual.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const response = await fetch('/api/admin/environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, expectedRevision: revision, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.details?.join(', ') || 'Preview recusado');
      setPreview(data);
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar preview');
    } finally {
      setWorking(false);
    }
  };

  const applyChanges = async () => {
    if (!preview || !confirmed) return;
    setWorking(true);
    setError('');
    try {
      const response = await fetch('/api/admin/environment/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: preview.requestId,
          confirmationToken: preview.confirmationToken,
          expectedRevision: preview.expectedRevision,
          reason,
          confirmed: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Aplicação recusada');
      setOperation({ id: data.operationId, status: data.status, impact: data.impact });
      setPreview(null);
      setDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar alterações');
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (!operation || !operation.status || TERMINAL.has(operation.status)) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/environment/operations/${operation.id || ''}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        setOperation(data);
        if (TERMINAL.has(data.status)) {
          clearInterval(timer);
          if (data.status === 'healthy') await load();
        }
      } catch { /* polling tolera falhas transitórias */ }
    }, 2000);
    return () => clearInterval(timer);
  }, [operation]);

  return (
    <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>🔐 Variáveis de Ambiente</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0.5rem 0 0' }}>
            Configuração da stack <code>portal-gerenciavel</code>. Segredos nunca são exibidos.
          </p>
        </div>
        <span className={`badge ${controllerAvailable ? 'badge-success' : 'badge-warning'}`}>
          {controllerAvailable ? 'Controlador disponível' : 'Controlador aguardando registro'}
        </span>
      </div>

      <details ref={helpPanelRef} style={{ marginTop: '1rem', border: '1px solid var(--color-border, #333)', borderRadius: 8, padding: '0.75rem 1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-gold)' }}>
          📖 Como obter ou gerar cada variável
        </summary>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {variables
            .filter((item) => item.howTo)
            .map((item) => (
              <div key={item.key} ref={(el) => { helpTargetRef.current[item.key] = el; }} style={{ fontSize: 'var(--text-sm)' }}>
                <strong>{item.key}</strong>
                <span style={{ color: 'var(--color-text-secondary)' }}> — {item.howTo}</span>
              </div>
            ))}
          {variables.every((item) => !item.howTo) && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Nenhuma instrução disponível no momento.
            </p>
          )}
        </div>
      </details>

      {!controllerAvailable && !loading && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(255,191,0,0.1)', color: 'var(--color-gold)', fontSize: 'var(--text-sm)' }}>
          O controlador operacional ainda não está registrado. A listagem é segura, mas o botão de preview/apply ficará bloqueado até ele estar saudável.
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: '1rem', color: 'var(--color-error)' }}>{error}</div>}

      <div className="table-wrapper" style={{ marginTop: '1rem' }}>
        <table className="admin-table">
          <thead><tr><th>Variável</th><th>Escopo</th><th>Fonte</th><th>Estado</th><th>Impacto</th><th>Novo valor</th></tr></thead>
          <tbody>
            {variables.map((item) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.key}</strong>
                  <small style={{ display: 'block', color: 'var(--color-text-tertiary)' }}>{item.description}</small>
                  {item.howTo && (
                    <button
                      type="button"
                      onClick={() => openHowTo(item.key)}
                      style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gold)', fontSize: 'var(--text-sm)', textDecoration: 'underline' }}
                      aria-label={`Como obter ${item.key}`}
                    >
                      Como obter?
                    </button>
                  )}
                </td>
                <td>{SCOPE_LABEL[item.scope] || item.scope}</td>
                <td>{item.source}</td>
                <td>
                  <span className={`badge ${item.configured === false ? 'badge-warning' : item.drift ? 'badge-error' : 'badge-secondary'}`}>
                    {item.drift ? 'Divergente' : item.configured === false ? 'Ausente' : item.configured === true ? 'Configurada' : 'Aguardando sync'}
                  </span>
                </td>
                <td>{IMPACT_LABEL[item.impact] || item.impact}</td>
                <td style={{ minWidth: 220 }}>
                  <input
                    className="input"
                    type={item.sensitive ? 'password' : 'text'}
                    disabled={!item.editable || !controllerAvailable}
                    placeholder={item.sensitive ? 'Vazio mantém o atual' : item.scope === 'derived' ? 'Editar fonte/override' : 'Novo valor'}
                    value={draft[item.key] || ''}
                    onChange={(event) => setDraft((current) => ({ ...current, [item.key]: event.target.value }))}
                    aria-label={`Novo valor para ${item.key}`}
                  />
                </td>
              </tr>
            ))}
            {!loading && variables.length === 0 && <tr><td colSpan={6}>Nenhuma variável disponível.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <label style={{ fontSize: 'var(--text-sm)' }}>
          Motivo da alteração
          <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex: rotacionar credencial SMTP" maxLength={500} />
        </label>
        <button type="button" className="btn btn-gold" disabled={!controllerAvailable || working} onClick={previewChanges}>
          {working ? 'Processando...' : 'Revisar alterações'}
        </button>
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--color-gold)', borderRadius: 8 }}>
          <h4>Confirmar alteração na produção</h4>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Esta operação sincronizará Portainer e <code>.env.local</code>. O site será reiniciado; alterações públicas/build podem reconstruir a imagem.
          </p>
          <ul style={{ fontSize: 'var(--text-sm)' }}>
            {Object.entries(preview.diff?.keys || {}).map(([key, value]) => (
              <li key={key}><strong>{key}</strong> — {value.sensitive ? 'segredo será rotacionado' : value.value || 'novo valor'} ({IMPACT_LABEL[value.impact] || value.impact})</li>
            ))}
          </ul>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            Entendo que o site poderá reiniciar ou ser reconstruído e confirmo a aplicação na stack <code>portal-gerenciavel</code>.
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!confirmed || working} onClick={applyChanges}>Confirmar e aplicar</button>
          </div>
        </div>
      )}

      {operation && (
        <div style={{ marginTop: '1rem', fontSize: 'var(--text-sm)' }} role="status">
          Operação: <strong>{operation.status}</strong> — impacto: {IMPACT_LABEL[operation.impact] || operation.impact}
          {operation.error_code && <span style={{ color: 'var(--color-error)' }}> — {operation.error_code}</span>}
        </div>
      )}
    </div>
  );
}
