'use client';

import { useCallback, useEffect, useState } from 'react';

interface LimiteItem {
  id: string;
  max: number;
  windowMs: number;
  maxPadrao: number;
  windowMsPadrao: number;
}

const ROTULOS: Record<string, { nome: string; desc: string }> = {
  login: { nome: 'Login', desc: 'Protege contra tentativas de senha em massa (força bruta).' },
  checkout: { nome: 'Finalização de Compra (Checkout)', desc: 'Evita criação abusiva de pedidos/cobranças.' },
  contato: { nome: 'Fale Conosco', desc: 'Evita flood de mensagens de contato (e-mails).' },
  desconto: { nome: 'Campanhas de Desconto', desc: 'Limita disparos que geram mensagens de IA.' },
  leads: { nome: 'Captura de Leads', desc: 'Limita envios do formulário de captura.' },
};

const msParaTexto = (ms: number) => {
  if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}h`;
  if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}min`;
  if (ms % 1000 === 0) return `${ms / 1000}s`;
  return `${ms}ms`;
};

export default function LimitesAcessoPage() {
  const [items, setItems] = useState<LimiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rate-limits');
      if (res.ok) setItems(await res.json());
      else {
        const d = await res.json().catch(() => ({}));
        setMsg({ tipo: 'erro', texto: d.error || 'Erro ao carregar limites.' });
      }
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message || 'Erro ao carregar limites.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const set = (id: string, campo: 'max' | 'windowMs', valor: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: Number(valor) || 0 } : i));

  const salvar = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, max: item.max, windowMs: item.windowMs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg({ tipo: 'ok', texto: `Limite "${ROTULOS[id].nome}" atualizado. As proteções entram em vigor imediatamente.` });
      setTimeout(() => setMsg(null), 5000);
      carregar();
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: `Erro ao salvar: ${e.message}` });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>API Rate Limits</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Proteção contra abuso: máximo de requisições por IP dentro de uma janela de tempo.
          </p>
        </div>
      </div>

      {msg && (
        <p style={{ marginBottom: 'var(--spacing-md)', color: msg.tipo === 'ok' ? 'var(--color-gold)' : 'var(--color-error)' }}>
          {msg.texto}
        </p>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-tertiary)', padding: '2rem', textAlign: 'center' }}>Loading...</p>
      ) : (
        <div className="admin-card">
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Regra</th>
                  <th style={{ minWidth: 90 }}>Máximo de requisições</th>
                  <th style={{ minWidth: 110 }}>Janela de tempo</th>
                  <th>Padrão atual</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{ROTULOS[item.id]?.nome || item.id}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{ROTULOS[item.id]?.desc}</div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        className="input"
                        style={{ width: 90 }}
                        value={item.max}
                        onChange={e => set(item.id, 'max', e.target.value)}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          className="input"
                          style={{ width: 110 }}
                          value={item.windowMs}
                          onChange={e => set(item.id, 'windowMs', e.target.value)}
                          title="Em milissegundos"
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>
                          = {msParaTexto(item.windowMs)}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {item.maxPadrao} req / {msParaTexto(item.windowMsPadrao)}
                    </td>
                    <td>
                      <button className="btn btn-gold btn-sm" onClick={() => salvar(item.id)} disabled={salvando}>
                        Salvar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-md)' }}>
            Observação: os limites são por IP e armazenados em memória — reiniciam quando o servidor é atualizado e não
            distinguem usuários diferentes atrás do mesmo IP (ex.: Wi-Fi compartilhado). Para restaurar os padrões, basta
            definir os valores acima novamente.
          </p>
        </div>
      )}
    </>
  );
}