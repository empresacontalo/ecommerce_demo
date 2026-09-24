'use client';

import { useCallback, useEffect, useState } from 'react';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  origin?: string;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_cpf: string | null;
  customer_phone: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total_price: number;
  payment_method: string;
  status: string;
  shipping_method: string | null;
  shipping_address: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
    nome?: string;
  } | null;
  tracking_code: string | null;
  tracking_link: string | null;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  pix_qr_code: string | null;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
}

const STATUS_OPTIONS = ['RECEBIDO', 'APROVADO', 'EM_PREPARACAO', 'ENVIADO', 'CANCELADO', 'DEVOLUCAO'];
const PAGAMENTO_OPTIONS = ['pix', 'credit', 'boleto'];
const ENVIO_OPTIONS = ['pac', 'sedex', 'motoboy', 'retirada'];
const RASTREIO_OPTIONS = ['Todos', 'com', 'sem'];
const ORDENACAO_OPTIONS = ['recentes', 'antigos', 'maior_valor', 'menor_valor'];
const STATUS_LABEL: Record<string, string> = {
  RECEBIDO: 'Pagamento recebido',
  APROVADO: 'Aprovado',
  EM_PREPARACAO: 'Em preparação',
  ENVIADO: 'Enviado',
  CANCELADO: 'Cancelado',
  DEVOLUCAO: 'Em devolução',
};
const STATUS_COLORS: Record<string, string> = {
  RECEBIDO: 'badge-warning',
  APROVADO: 'badge-success',
  EM_PREPARACAO: 'badge-info',
  ENVIADO: 'badge-primary',
  CANCELADO: 'badge-error',
  DEVOLUCAO: 'badge-secondary',
};

const fmtBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (v: string) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('Todos');
  const [pagamento, setPagamento] = useState('Todos');
  const [envio, setEnvio] = useState('Todos');
  const [rastreio, setRastreio] = useState('Todos');
  const [ordenar, setOrdenar] = useState('recentes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [detalhe, setDetalhe] = useState<Order | null>(null);
  const [msg, setMsg] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingLinkInput, setTrackingLinkInput] = useState('');

  const salvarRastreio = async (o: Order) => {
    const codigo = trackingInput.trim().toUpperCase();
    const link = trackingLinkInput.trim();
    if (!codigo && !link) { setMsg('Informe o código dos Correios ou o link de acompanhamento.'); setTimeout(() => setMsg(''), 3000); return; }
    if (await salvar(o, { tracking_code: codigo || undefined, tracking_link: link || undefined })) {
      setTrackingInput('');
      setTrackingLinkInput('');
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (status !== 'Todos') params.set('status', status);
      if (pagamento !== 'Todos') params.set('pagamento', pagamento);
      if (envio !== 'Todos') params.set('envio', envio);
      if (rastreio !== 'Todos') params.set('rastreio', rastreio);
      if (dataInicio) params.set('data_inicio', dataInicio);
      if (dataFim) params.set('data_fim', dataFim);
      params.set('ordenar', ordenar);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (res.ok) setOrders(await res.json());
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, [busca, status, pagamento, envio, rastreio, dataInicio, dataFim, ordenar]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  const salvar = async (o: Order, mudanca: Partial<Order>): Promise<boolean> => {
    const res = await fetch('/api/admin/orders', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, ...mudanca }),
    });
    if (res.ok) {
      const atualizado = await res.json();
      setOrders(prev => prev.map(p => p.id === o.id ? atualizado : p));
      if (detalhe?.id === o.id) setDetalhe(atualizado);
      setMsg(`Pedido #${o.id.slice(0, 8)} atualizado ✓`);
      setTimeout(() => setMsg(''), 3000);
      return true;
    }
    return false;
  };

  const mudarStatus = async (o: Order, novo: string) => {
    if (await salvar(o, { status: novo })) setMsg(`Pedido ${o.id.slice(0, 8)} → ${STATUS_LABEL[novo] || novo}`);
  };

  const excluir = async (o: Order) => {
    if (!confirm(`Excluir o pedido #${o.id.slice(0, 8)}?`)) return;
    const res = await fetch(`/api/admin/orders/${o.id}`, { method: 'DELETE' });
    if (res.ok) {
      setOrders(prev => prev.filter(p => p.id !== o.id));
      setDetalhe(null);
    }
  };

  const itens = detalhe?.items || [];
  const totalItens = itens.reduce((s, i) => s + (Number(i.price) * Number(i.quantity || 1)), 0);
  const end = detalhe?.shipping_address;

  if (detalhe) {
    return (
      <>
        <div className="admin-page-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setDetalhe(null)}>← Voltar</button>
            <h2>Pedido #{detalhe.id.slice(0, 8)}</h2>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select
              className="input"
              style={{ maxWidth: 200 }}
              value={detalhe.status}
              onChange={e => mudarStatus(detalhe, e.target.value)}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => excluir(detalhe)}>🗑 Excluir</button>
          </div>
        </div>

        {msg && <p style={{ color: 'var(--color-gold)', marginBottom: 'var(--spacing-md)' }}>{msg}</p>}

        {/* Cliente */}
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Cliente</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-md)', fontSize: 'var(--text-sm)' }}>
            <div><strong>Nome:</strong> {detalhe.customer_name}</div>
            <div><strong>E-mail:</strong> {detalhe.customer_email}</div>
            <div><strong>CPF:</strong> {detalhe.customer_cpf || '—'}</div>
            <div><strong>Telefone:</strong> {detalhe.customer_phone || '—'}</div>
            <div><strong>Pagamento:</strong> {detalhe.payment_method}</div>
            <div><strong>Data:</strong> {fmtData(detalhe.created_at)}</div>
          </div>
        </div>

        {/* Entrega e Rastreamento */}
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Entrega e Rastreamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)' }}>
            <div><strong>Método:</strong> {detalhe.shipping_method || '—'}</div>
            <div><strong>Custo do envio:</strong> {fmtBRL(detalhe.shipping)}</div>
            <div><strong>Status:</strong> <span className={`badge ${STATUS_COLORS[detalhe.status] || 'badge-secondary'}`}>{STATUS_LABEL[detalhe.status] || detalhe.status}</span></div>
          </div>

          {end ? (
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-lg)', lineHeight: 1.7 }}>
              <strong>Endereço de entrega:</strong><br />
              {[end.nome, end.street && `${end.street}${end.number ? `, ${end.number}` : ''}`, end.complement, end.neighborhood, end.city && `${end.city}${end.state ? `/${end.state}` : ''}`, end.cep && `CEP ${end.cep}`].filter(Boolean).join(' — ')}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Retirada na loja (sem endereço de entrega)</div>
          )}

          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--spacing-md)' }}>
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 4 }}>
              <strong>Código de rastreamento (Correios):</strong>{' '}
              {detalhe.tracking_code ? (
                <span style={{ fontFamily: 'monospace', background: 'rgba(212,175,55,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(212,175,55,0.3)' }}>
                  {detalhe.tracking_code}
                </span>
              ) : (
                <span style={{ color: 'var(--color-text-tertiary)' }}>não informado</span>
              )}
            </div>
            {detalhe.tracking_code && (
              <a
                href={`https://www.correios.com.br/rastreamento?sro=${detalhe.tracking_code}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-gold)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'underline' }}
              >
                Rastrear nos Correios ↗
              </a>
            )}
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 4, marginTop: 8 }}>
              <strong>Link de acompanhamento do entregador:</strong>{' '}
              {detalhe.tracking_link ? (
                <a href={detalhe.tracking_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-gold)', fontWeight: 600, textDecoration: 'underline' }}>
                  Acompanhar entrega ↗
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-tertiary)' }}>não informado</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--spacing-md)', maxWidth: 640, flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input"
                placeholder="Código dos Correios (ex: LB123456789BR)"
                value={trackingInput}
                onChange={e => setTrackingInput(e.target.value)}
                style={{ textTransform: 'uppercase', flex: 1, minWidth: 200 }}
              />
              <input
                type="text"
                className="input"
                placeholder="ou link do entregador (https://...)"
                value={trackingLinkInput}
                onChange={e => setTrackingLinkInput(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button className="btn btn-gold btn-sm" onClick={() => salvarRastreio(detalhe)}>Salvar Rastreio</button>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '0.5rem', marginBottom: 0 }}>
              Informe o código dos Correios <strong>ou</strong> o link de acompanhamento. Ao salvar com o status <strong>Enviado</strong>, o cliente é avisado por e-mail e pela caixa do agente de atendimento (WhatsApp quando conectado).
            </p>
          </div>
        </div>

        {/* Itens */}
        <div className="admin-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Itens</h3>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead>
              <tbody>
                {itens.map((i, idx) => (
                  <tr key={idx}>
                    <td>{i.name}</td>
                    <td>{i.quantity}</td>
                    <td>{fmtBRL(i.price)}</td>
                    <td>{fmtBRL(Number(i.price) * Number(i.quantity || 1))}</td>
                  </tr>
                ))}
                {itens.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--color-text-tertiary)' }}>Sem itens registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginTop: 'var(--spacing-md)', fontSize: 'var(--text-sm)' }}>
            <span>Subtotal: {fmtBRL(detalhe.subtotal ?? totalItens)}</span>
            {Number(detalhe.discount) > 0 && <span style={{ color: 'var(--color-gold)' }}>Desconto: −{fmtBRL(detalhe.discount)}</span>}
            <span>Frete: {fmtBRL(detalhe.shipping)}</span>
            <strong style={{ fontSize: '1rem' }}>Total: {fmtBRL(detalhe.total_price)}</strong>
          </div>
        </div>

        {/* Pagamento */}
        {(detalhe.pix_qr_code || detalhe.boleto_url || detalhe.asaas_invoice_url) && (
          <div className="admin-card">
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Pagamento</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)' }}>
              {detalhe.asaas_payment_id && <span><strong>ID do pagamento:</strong> {detalhe.asaas_payment_id}</span>}
              {detalhe.asaas_invoice_url && <span><strong>Fatura:</strong> <a href={detalhe.asaas_invoice_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-gold)' }}>{detalhe.asaas_invoice_url}</a></span>}
              {detalhe.pix_qr_code && (
                <span><strong>PIX copia e cola:</strong> <span style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8rem' }}>{detalhe.pix_qr_code}</span></span>
              )}
              {detalhe.boleto_linha_digitavel && <span><strong>Linha digitável:</strong> {detalhe.boleto_linha_digitavel}</span>}
              {detalhe.boleto_url && <span><strong>Boleto:</strong> <a href={detalhe.boleto_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-gold)' }}>Abrir boleto</a></span>}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h2>Gerenciamento de Pedidos</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            {orders.length} pedido(s)
          </p>
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar por cliente, e-mail ou ID..."
            style={{ maxWidth: 300 }}
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <select className="input" style={{ maxWidth: 180 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="Todos">Todos os Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="input" style={{ maxWidth: 180 }} value={pagamento} onChange={e => setPagamento(e.target.value)}>
            <option value="Todos">Todos os Pagamentos</option>
            {PAGAMENTO_OPTIONS.map(s => <option key={s} value={s}>{s === 'pix' ? 'PIX' : s === 'credit' ? 'Cartão' : 'Boleto'}</option>)}
          </select>
          <select className="input" style={{ maxWidth: 180 }} value={envio} onChange={e => setEnvio(e.target.value)}>
            <option value="Todos">Todos os Envios</option>
            {ENVIO_OPTIONS.map(s => <option key={s} value={s}>{s === 'pac' ? 'PAC (Correios)' : s === 'sedex' ? 'SEDEX' : s === 'motoboy' ? 'Motoboy' : 'Retirada na Loja'}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            Rastreio:
            <select className="input" style={{ maxWidth: 150 }} value={rastreio} onChange={e => setRastreio(e.target.value)}>
              {RASTREIO_OPTIONS.map(s => <option key={s} value={s}>{s === 'Todos' ? 'Todos' : s === 'com' ? 'Com rastreio' : 'Sem rastreio'}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            De:
            <input type="date" className="input" style={{ maxWidth: 160 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </label>
          <label style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            Até:
            <input type="date" className="input" style={{ maxWidth: 160 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </label>
          <label style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
            Ordenar:
            <select className="input" style={{ maxWidth: 180 }} value={ordenar} onChange={e => setOrdenar(e.target.value)}>
              {ORDENACAO_OPTIONS.map(s => <option key={s} value={s}>{s === 'recentes' ? 'Mais recentes' : s === 'antigos' ? 'Mais antigos' : s === 'maior_valor' ? 'Maior valor' : 'Menor valor'}</option>)}
            </select>
          </label>
          {(busca || status !== 'Todos' || pagamento !== 'Todos' || envio !== 'Todos' || rastreio !== 'Todos' || dataInicio || dataFim) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setBusca(''); setStatus('Todos'); setPagamento('Todos'); setEnvio('Todos');
                setRastreio('Todos'); setDataInicio(''); setDataFim(''); setOrdenar('recentes');
              }}
            >
              ✕ Limpar filtros
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>#{o.id.slice(0, 8)}</td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>{fmtData(o.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{o.customer_email}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtBRL(o.total_price)}</td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[o.status] || 'badge-secondary'}`}>{STATUS_LABEL[o.status] || o.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setDetalhe(o)}>Ver Detalhes</button>
                      <select
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 8px', maxWidth: 140 }}
                        value={o.status}
                        onChange={e => mudarStatus(o, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ color: 'var(--color-text-tertiary)', textAlign: 'center' }}>Nenhum pedido encontrado.</td></tr>
              )}
            </tbody>
          </table>
          {loading && <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '1rem' }}>Carregando...</p>}
        </div>
      </div>
    </>
  );
}