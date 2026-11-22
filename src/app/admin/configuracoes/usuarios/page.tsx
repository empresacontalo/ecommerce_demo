'use client';

import { useState, useEffect } from 'react';

export default function GestaoUsuariosPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');
  const [showNovo, setShowNovo] = useState(false);
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', status: 'approved' });
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const url = filter !== 'all'
        ? `/api/admin/users?status=${filter}`
        : '/api/admin/users';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        console.error('Erro ao buscar usuários:', data.error);
      } else {
        setAdmins(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, [filter]);

  const criarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novo.nome.trim() || !novo.email.trim()) {
      setMsg({ tipo: 'erro', texto: 'Nome e email são obrigatórios.' });
      return;
    }
    if (novo.senha && novo.senha.length < 8) {
      setMsg({ tipo: 'erro', texto: 'A senha deve ter no mínimo 8 caracteres (ou deixe vazia para login por Google).' });
      return;
    }
    setCriando(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: data.error || 'Erro ao criar usuário.' });
      } else {
        setMsg({ tipo: 'ok', texto: `Usuário criado: ${data.email} (${data.status === 'approved' ? 'aprovado' : 'pendente'})` });
        setNovo({ nome: '', email: '', senha: '', status: 'approved' });
        setShowNovo(false);
        fetchAdmins();
      }
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: err.message || 'Erro ao criar usuário.' });
    }
    setCriando(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: 'Erro ao atualizar status: ' + (data.error || 'Erro desconhecido') });
      } else {
        setMsg({ tipo: 'ok', texto: 'Status atualizado.' });
        fetchAdmins();
      }
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao atualizar status: ' + err.message });
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: 'Erro ao excluir: ' + (data.error || 'Erro desconhecido') });
      } else {
        setMsg({ tipo: 'ok', texto: 'Usuário excluído.' });
        fetchAdmins();
      }
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao excluir: ' + err.message });
    }
    setActionLoading(null);
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending';
      case 'blocked': return 'Blocked';
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'approved': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'pending': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'blocked': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      default: return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 'var(--spacing-lg)' }}>
        Admin User Management
      </h1>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)', alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'approved', 'blocked'] as const).map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-gold' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todos' : statusLabel(f)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => setShowNovo(v => !v)}>
          {showNovo ? '✕ Cancelar' : '+ New Admin'}
        </button>
      </div>

      {msg && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--text-sm)',
          background: msg.tipo === 'ok' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: msg.tipo === 'ok' ? '#10b981' : '#ef4444',
        }}>{msg.texto}</div>
      )}

      {showNovo && (
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1rem', fontWeight: 600 }}>
            Create New Admin User
          </h3>
          <form onSubmit={criarAdmin}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-md)' }}>
              <div className="input-group">
                <label>Nome completo *</label>
                <input
                  className="input"
                  value={novo.nome}
                  onChange={e => setNovo({ ...novo, nome: e.target.value })}
                  placeholder="Ex: Maria Silva"
                  required
                />
              </div>
              <div className="input-group">
                <label>E-mail *</label>
                <input
                  className="input"
                  type="email"
                  value={novo.email}
                  onChange={e => setNovo({ ...novo, email: e.target.value })}
                  placeholder="usuario@email.com"
                  required
                />
              </div>
              <div className="input-group">
                <label>Senha (opcional)</label>
                <input
                  className="input"
                  type="password"
                  value={novo.senha}
                  onChange={e => setNovo({ ...novo, senha: e.target.value })}
                  placeholder="Mín. 8 — vazio = login Google"
                />
              </div>
              <div className="input-group">
                <label>Status inicial</label>
                <select
                  className="input"
                  value={novo.status}
                  onChange={e => setNovo({ ...novo, status: e.target.value })}
                >
                  <option value="approved">Approved (acesso imediato)</option>
                  <option value="pending">Pending (aguardando aprovação)</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="submit" className="btn btn-gold" disabled={criando}>
                {criando ? 'Criando...' : 'Criar Usuário'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowNovo(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left' }}>Name</th>
              <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left' }}>Email</th>
              <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left' }}>Status</th>
              <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left' }}>Date</th>
              <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && admins.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No admin users found.
                </td>
              </tr>
            )}
            {admins.map((admin) => (
              <tr key={admin.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: 'var(--spacing-sm)' }}>{admin.full_name || '-'}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>{admin.email}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>
                  <span style={{
                    ...statusColor(admin.status),
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}>
                    {statusLabel(admin.status)}
                  </span>
                </td>
                <td style={{ padding: 'var(--spacing-sm)', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  {new Date(admin.created_at).toLocaleDateString('en-US')}
                </td>
                <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
                    {admin.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-gold btn-sm"
                          onClick={() => handleStatusChange(admin.id, 'approved')}
                          disabled={actionLoading === admin.id}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                          onClick={() => handleStatusChange(admin.id, 'blocked')}
                          disabled={actionLoading === admin.id}
                        >
                          Block
                        </button>
                      </>
                    )}
                    {admin.status === 'approved' && (
                      <button
                        className="btn btn-sm"
                        style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                        onClick={() => handleStatusChange(admin.id, 'blocked')}
                        disabled={actionLoading === admin.id}
                      >
                        Block
                      </button>
                    )}
                    {admin.status === 'blocked' && (
                      <button
                        className="btn btn-gold btn-sm"
                        onClick={() => handleStatusChange(admin.id, 'approved')}
                        disabled={actionLoading === admin.id}
                      >
                        Desbloquear
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-error)' }}
                      onClick={() => handleDelete(admin.id)}
                      disabled={actionLoading === admin.id}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
