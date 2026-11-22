'use client';

import { useCallback, useEffect, useState } from 'react';

interface Agendamento {
  id: string;
  client_name: string;
  client_phone: string;
  service: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  price: number | null;
}

interface Stats {
  hoje: number;
  semana: number;
  confirmados: number;
  no_show: number;
  ativos: number;
}

const STATUS_OPTIONS = ['Pending', 'Confirmed', 'Canceled', 'Compareceu', 'Não Compareceu'];
const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'badge-success',
  Pending: 'badge-warning',
  Canceled: 'badge-error',
  Compareceu: 'badge-success',
  'Não Compareceu': 'badge-error',
};

const formStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
};

export default function AdminAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<{ modo: 'novo' | 'editar'; agendamento?: Agendamento } | null>(null);
  const [form, setForm] = useState({ client_name: '', client_phone: '', service: '', scheduled_at: '', status: 'Pending', notes: '', price: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'Todos') params.set('status', filter);
      if (busca) params.set('busca', busca);
      const [listaRes, statsRes] = await Promise.all([
        fetch(`/api/admin/agendamentos?${params.toString()}`),
        fetch('/api/admin/agendamentos?stats=1'),
      ]);
      if (listaRes.ok) setAgendamentos(await listaRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, [filter, busca]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, price: form.price ? Number(form.price) : null };
      const res = await fetch('/api/admin/agendamentos', {
        method: modal?.modo === 'editar' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modal?.modo === 'editar' ? { ...body, id: modal.agendamento?.id } : body),
      });
      if (res.ok) {
        setModal(null);
        setMsg(modal?.modo === 'editar' ? 'Agendamento atualizado!' : 'Agendamento criado!');
        setTimeout(() => setMsg(''), 3000);
        carregar();
      } else {
        const d = await res.json();
        setMsg(d?.error || 'Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  const mudarStatus = async (a: Agendamento, status: string) => {
    const res = await fetch('/api/admin/agendamentos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, status }),
    });
    if (res.ok) carregar();
  };

  const excluir = async (a: Agendamento) => {
    if (!confirm(`Excluir o agendamento de ${a.client_name}?`)) return;
    const res = await fetch('/api/admin/agendamentos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id }),
    });
    if (res.ok) carregar();
  };

  const abrirNovo = () => {
    setModal({ modo: 'novo' });
    setForm({ client_name: '', client_phone: '', service: '', scheduled_at: '', status: 'Pending', notes: '', price: '' });
  };

  const abrirEdicao = (a: Agendamento) => {
    setModal({ modo: 'editar', agendamento: a });
    setForm({
      client_name: a.client_name,
      client_phone: a.client_phone,
      service: a.service,
      scheduled_at: a.scheduled_at ? a.scheduled_at.slice(0, 16) : '',
      status: a.status,
      notes: a.notes || '',
      price: a.price != null ? String(a.price) : '',
    });
  };

  const fmtData = (v: string) => new Date(v).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtHora = (v: string) => new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtTel = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const campo = (k: keyof typeof form, label: string, tipo = 'text') => (
    <div className="input-group">
      <label>{label}</label>
      <input
        className="input"
        style={formStyle}
        type={tipo}
        required={k === 'client_name' || k === 'client_phone' || k === 'service' || k === 'scheduled_at'}
        value={form[k]}
        onChange={e => {
          const v = k === 'client_phone' ? fmtTel(e.target.value) : e.target.value;
          setForm(p => ({ ...p, [k]: v }));
        }}
      />
    </div>
  );

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Appointment Management</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            {stats?.ativos ?? 0} agendamentos ativos
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ New Appointment</button>
      </div>

      {msg && <p style={{ color: 'var(--color-gold)', marginBottom: 'var(--spacing-md)' }}>{msg}</p>}

      {/* Stats reais */}
      <div className="admin-stats-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
        {[
          { label: 'Hoje', value: stats?.hoje ?? 0, icon: '📅' },
          { label: 'Esta Semana', value: stats?.semana ?? 0, icon: '📆' },
          { label: 'Confirmeds', value: stats?.confirmados ?? 0, icon: '✅' },
          { label: 'Não Compareceram', value: stats?.no_show ?? 0, icon: '⚠️' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ fontSize: '1.4rem' }}>{s.icon}</div>
            <div className="stat-info">
              <h4>{s.label}</h4>
              <div className="stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
          {['Todos', ...STATUS_OPTIONS].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(s)}
            >{s}</button>
          ))}
          <input
            className="input"
            placeholder="Buscar por cliente, telefone ou serviço..."
            style={{ maxWidth: 260, marginLeft: 'auto' }}
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Data & Hora</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agendamentos.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{a.client_name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                      <a href={`https://wa.me/55${a.client_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366' }}>{a.client_phone}</a>
                    </div>
                  </td>
                  <td>
                    <div>{a.service}</div>
                    {a.notes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{a.notes}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{fmtData(a.scheduled_at)}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>🕐 {fmtHora(a.scheduled_at)}</div>
                  </td>
                  <td>{a.price != null ? a.price.toLocaleString('en-US', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                  <td>
                    <select
                      className={`badge ${STATUS_COLORS[a.status] || 'badge-secondary'}`}
                      style={{ border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 8px' }}
                      value={a.status}
                      onChange={e => mudarStatus(a, e.target.value)}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => abrirEdicao(a)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => excluir(a)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {agendamentos.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>No appointments found.</td></tr>
              )}
            </tbody>
          </table>
          {loading && <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '1rem' }}>Loading...</p>}
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--color-dark-soft)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.5rem', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              {modal.modo === 'editar' ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h3>
            <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {campo('client_name', 'Cliente *')}
              {campo('client_phone', 'Telefone/WhatsApp *')}
              {campo('service', 'Serviço *')}
              {campo('scheduled_at', 'Data e Hora *', 'datetime-local')}
              <div className="input-group">
                <label>Status</label>
                <select style={formStyle} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {campo('price', 'Valor (R$)', 'number')}
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea style={{ ...formStyle, minHeight: 70 }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
