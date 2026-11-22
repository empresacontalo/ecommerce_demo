'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PedidoRecente {
  id: string;
  created_at: string;
  customer_name: string;
  status: string;
  total_price: number;
}

interface DashboardData {
  vendas_mes: number;
  total_pedidos: number;
  total_clientes: number;
  leads_novos: number;
  agendamentos_hoje: number;
  ultimos_pedidos: PedidoRecente[];
}

const STATUS_BADGE: Record<string, string> = {
  RECEBIDO: 'badge-warning',
  APROVADO: 'badge-success',
  EM_PREPARACAO: 'badge-info',
  ENVIADO: 'badge-primary',
  CANCELADO: 'badge-error',
  DEVOLUCAO: 'badge-secondary',
};

const STATUS_LABEL: Record<string, string> = {
  RECEBIDO: 'Payment Received',
  APROVADO: 'Approved',
  EM_PREPARACAO: 'Preparing',
  ENVIADO: 'Shipped',
  CANCELADO: 'Canceled',
  DEVOLUCAO: 'Returned',
};

const fmtCurrency = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* noop */ }
    })();
  }, []);

  const stats = [
    { label: 'Monthly Sales', value: data ? fmtCurrency(data.vendas_mes) : '—', icon: '💵', href: '/admin/pedidos' },
    { label: 'Orders', value: data?.total_pedidos ?? '—', icon: '📦', href: '/admin/pedidos' },
    { label: 'Customers', value: data?.total_clientes ?? '—', icon: '👥', href: '/admin/configuracoes/usuarios' },
    { label: 'New Leads', value: data?.leads_novos ?? '—', icon: '⭐', href: '/admin/leads' },
    { label: 'Appointments Today', value: data?.agendamentos_hoje ?? '—', icon: '📅', href: '/admin/agendamentos' },
  ];

  return (
    <>
      <div className="admin-stats-grid">
        {stats.map((s, i) => (
          <Link key={i} href={s.href} className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <div className="stat-icon" style={{ fontSize: '1.4rem' }}>{s.icon}</div>
            <div className="stat-info">
              <h4>{s.label}</h4>
              <div className="stat-value">{s.value}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Recent Orders</h3>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(data?.ultimos_pedidos || []).map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>#{p.id.slice(0, 8)}</td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{new Date(p.created_at).toLocaleDateString('en-US')}</td>
                  <td style={{ fontWeight: 500 }}>{p.customer_name}</td>
                  <td><span className={`badge ${STATUS_BADGE[p.status] || 'badge-secondary'}`}>{STATUS_LABEL[p.status] || p.status}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmtCurrency(Number(p.total_price))}</td>
                </tr>
              ))}
              {(!data || data.ultimos_pedidos.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                    No orders yet. <Link href="/loja/checkout" style={{ color: 'var(--color-gold)' }}>Place a test order</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
