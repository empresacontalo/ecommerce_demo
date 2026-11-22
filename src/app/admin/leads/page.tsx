'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/auth/client';

interface Lead {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  score: number;
}

const STATUS_COLORS: Record<string, string> = {
  'Novo': 'badge-secondary',
  'Em Contato': 'badge-info',
  'Interessado': 'badge-warning',
  'Proposta Enviada': 'badge-gold',
  'Convertido': 'badge-success',
  'Pós-venda': 'badge-purple',
  'Inativo': 'badge-error',
};

const SOURCE_ICON: Record<string, string> = {
  'Instagram': '📸',
  'WhatsApp': '💬',
  'Formulário': '📋',
};

export default function AdminLeads() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showNovo, setShowNovo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [novo, setNovo] = useState({
    name: '', phone: '', email: '', instagram: '',
    source: 'Manual', status: 'Novo', score: 50,
  });

  const kanbanCols = ['Novo', 'Em Contato', 'Interessado', 'Proposta Enviada', 'Convertido', 'Pós-venda', 'Inativo'];

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/leads');
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao buscar leads via API:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    } catch (error) {
      console.error('Erro ao atualizar status do lead:', error);
      alert('Erro ao atualizar status');
    }
  }

  const filtered = leads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search);
    const matchStatus = statusFilter === 'Todos' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function criarLead(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.name.trim() || !novo.phone.trim()) {
      setMsg({ tipo: 'erro', texto: 'Nome e telefone são obrigatórios.' });
      return;
    }
    setCriando(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: data.error || 'Erro ao criar lead.' });
      } else {
        setMsg({ tipo: 'ok', texto: `Lead criado: ${data.name}` });
        setNovo({ name: '', phone: '', email: '', instagram: '', source: 'Manual', status: 'Novo', score: 50 });
        setShowNovo(false);
        fetchLeads();
      }
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: err.message || 'Erro ao criar lead.' });
    }
    setCriando(false);
  };

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Lead Management</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            {leads.length} leads cadastrados
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button className="btn btn-ghost btn-sm">📥 Exportar CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNovo(v => !v)}>+ New Lead</button>
        </div>
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
            Create New Lead
          </h3>
          <form onSubmit={criarLead}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-md)' }}>
              <div className="input-group">
                <label>Nome completo *</label>
                <input className="input" value={novo.name} onChange={e => setNovo({ ...novo, name: e.target.value })} placeholder="Nome do cliente" required />
              </div>
              <div className="input-group">
                <label>Telefone/WhatsApp *</label>
                <input className="input" value={novo.phone} onChange={e => setNovo({ ...novo, phone: e.target.value })} placeholder="(11) 99999-9999" required />
              </div>
              <div className="input-group">
                <label>E-mail</label>
                <input className="input" type="email" value={novo.email} onChange={e => setNovo({ ...novo, email: e.target.value })} placeholder="cliente@email.com" />
              </div>
              <div className="input-group">
                <label>Instagram</label>
                <input className="input" value={novo.instagram} onChange={e => setNovo({ ...novo, instagram: e.target.value })} placeholder="@cliente" />
              </div>
              <div className="input-group">
                <label>Canal</label>
                <select className="input" value={novo.source} onChange={e => setNovo({ ...novo, source: e.target.value })}>
                  <option>Manual</option>
                  <option>Instagram</option>
                  <option>WhatsApp</option>
                  <option>Formulário</option>
                  <option>Indicação</option>
                </select>
              </div>
              <div className="input-group">
                <label>Status</label>
                <select className="input" value={novo.status} onChange={e => setNovo({ ...novo, status: e.target.value })}>
                  {kanbanCols.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Score (0-100)</label>
                <input className="input" type="number" min={0} max={100} value={novo.score} onChange={e => setNovo({ ...novo, score: Number(e.target.value) })} />
              </div>
            </div>
            <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button type="submit" className="btn btn-gold" disabled={criando}>
                {criando ? 'Criando...' : 'Criar Lead'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowNovo(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters + View Toggle */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar por nome ou telefone..."
            style={{ maxWidth: 280 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input" style={{ maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option>All</option>
            {kanbanCols.map(s => <option key={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            <button
              className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('table')}
            >☰ Tabela</button>
            <button
              className={`btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('kanban')}
            >⊞ Kanban</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Carregando leads...
        </div>
      ) : view === 'table' ? (
        <div className="admin-card">
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Canal</th>
                  <th>Phone</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                          {l.name[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{l.name}</div>
                          {l.email && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{l.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{SOURCE_ICON[l.source]} {l.source}</td>
                    <td>
                      <a href={`https://wa.me/55${l.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366' }}>
                        {l.phone}
                      </a>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 40, height: 6, background: 'rgba(255,255,255,0.1)',
                          borderRadius: 99, overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${l.score}%`, height: '100%',
                            background: l.score >= 80 ? 'var(--color-gold)' : l.score >= 50 ? '#f59e0b' : '#ef4444',
                            borderRadius: 99
                          }} />
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{l.score}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[l.status] || 'badge-secondary'}`}>{l.status}</span></td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {new Date(l.created_at).toLocaleDateString('en-US')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>Ver</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>💬</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN VIEW */
        <div className="leads-kanban">
          {kanbanCols.map(col => {
            const colLeads = leads.filter(l => l.status === col);
            return (
              <div key={col} className="kanban-col">
                <div className="kanban-col-header">
                  <span className={`badge ${STATUS_COLORS[col] || 'badge-secondary'}`}>{col}</span>
                  <span className="kanban-count">{colLeads.length}</span>
                </div>
                <div className="kanban-cards">
                  {colLeads.map(l => (
                    <div key={l.id} className="kanban-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 'var(--text-xs)', flexShrink: 0 }}>{l.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{l.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{SOURCE_ICON[l.source]} {l.source}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>{l.phone}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Score: {l.score}</span>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}>Ver</button>
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                      Nenhum lead aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
