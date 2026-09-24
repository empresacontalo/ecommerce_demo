import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  notificarStatusPedido: vi.fn().mockResolvedValue('ok'),
}));

vi.mock('@/utils/db', () => ({ query: mocks.query }));
vi.mock('@/utils/pedido-emails', () => ({ notificarStatusPedido: mocks.notificarStatusPedido }));
vi.mock('@/app/actions/cms', () => ({
  getConfiguracao: async (chave: string) => (
    chave === 'header.logo' ? { texto: 'Fragrance E-commerce Demo' } : { valor: 'whsec_secret_teste' }
  ),
}));
vi.mock('@/utils/empresa-default', () => ({ EMPRESA_NOME_PADRAO: 'Fragrance E-commerce Demo' }));

function webhookReq(payload: unknown, sig = 'whsec_secret_teste') {
  return new Request('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': sig },
    body: JSON.stringify(payload),
  });
}

describe('Webhook Asaas — estoque só debita no pagamento recebido', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.notificarStatusPedido.mockReset().mockResolvedValue('ok');
  });

  it('PAYMENT_RECEIVED debita o estoque dos itens do pedido', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'RECEBIDO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return {
          rows: [{
            id: 'pedido-x', customer_name: 'A', customer_email: 'a@b.c', status: 'RECEBIDO',
            shipping_method: 'retirada', total_price: 5,
            items: [{ id: 'prod-1', quantity: 2, name: 'Teste' }],
          }],
        };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_ok', status: 'RECEIVED' },
    }));

    expect(res.status).toBe(200);
    const debito = mocks.query.mock.calls.find((c) => String(c[0]).includes('stock = stock - $1'));
    expect(debito).toBeTruthy();
    expect(debito![1]).toEqual([2, 'prod-1']);
    // não deve haver devolução de estoque
    expect(mocks.query.mock.calls.some((c) => String(c[0]).includes('stock = stock + $1'))).toBe(false);
  });

  it('PAYMENT_DELETED de pedido NÃO pago não devolve estoque (nunca foi debitado)', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'RECEBIDO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return {
          rows: [{
            id: 'pedido-y', customer_name: 'B', customer_email: 'b@c.d', status: 'RECEBIDO',
            shipping_method: 'retirada', total_price: 5,
            items: [{ id: 'prod-1', quantity: 2 }],
          }],
        };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_DELETED',
      payment: { id: 'pay_delete', status: 'DELETED' },
    }));

    expect(res.status).toBe(200);
    expect(mocks.query.mock.calls.some((c) => String(c[0]).includes('stock = stock + $1'))).toBe(false);
  });

  it('PAYMENT_DELETED de pedido JÁ PAGO devolve o estoque', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'APROVADO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return {
          rows: [{
            id: 'pedido-z', customer_name: 'C', customer_email: 'c@d.e', status: 'APROVADO',
            shipping_method: 'retirada', total_price: 5,
            items: [{ id: 'prod-1', quantity: 3 }],
          }],
        };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_DELETED',
      payment: { id: 'pay_refund', status: 'DELETED' },
    }));

    expect(res.status).toBe(200);
    const devolucao = mocks.query.mock.calls.find((c) => String(c[0]).includes('stock = stock + $1'));
    expect(devolucao).toBeTruthy();
    expect(devolucao![1]).toEqual([3, 'prod-1']);
  });

  it('PAYMENT_CONFIRMED move o lead do pedido para Convertido no kanban', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'RECEBIDO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return {
          rows: [{
            id: 'pedido-x', lead_id: 'lead-kanban-1', customer_name: 'A', customer_email: 'a@b.c', status: 'RECEBIDO',
            shipping_method: 'retirada', total_price: 5,
            items: [{ id: 'prod-1', quantity: 1 }],
          }],
        };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_ok', status: 'CONFIRMED' },
    }));

    expect(res.status).toBe(200);
    const upLead = mocks.query.mock.calls.find((c) => String(c[0]).includes('UPDATE public.leads'));
    expect(upLead).toBeTruthy();
    expect(String(upLead![0])).toContain("'Convertido'");
    expect(upLead![1]).toEqual(['lead-kanban-1']);
  });

  it('sem vínculo com lead, não quebra o webhook (kanban permanece intacto)', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'APROVADO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return { rows: [{ id: 'pedido-v3', customer_name: 'A', customer_email: 'a@b.c', status: 'APROVADO', shipping_method: 'retirada', total_price: 5, items: [] }] };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_sem_lead', status: 'CONFIRMED' },
    }));

    expect(res.status).toBe(200);
    // pedido já estava APROVADO → idempotência: não deve mover lead novamente
    expect(mocks.query.mock.calls.some((c) => String(c[0]).includes('UPDATE public.leads'))).toBe(false);
  });

  it('rejeita assinatura inválida', async () => {
    const res = await POST(webhookReq({ event: 'x', payment: { id: 'y' } }, 'assinatura-errada'));
    expect(res.status).toBe(401);
  });

  it('aceita o header do Asaas v3 (próprio token, comparação direta)', async () => {
    // O Asaas v3 envia `asaas-access-token` com o MESMO token configurado.
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'RECEBIDO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return {
          rows: [{
            id: 'pedido-v3', customer_name: 'A', customer_email: 'a@b.c', status: 'RECEBIDO',
            shipping_method: 'retirada', total_price: 5,
            items: [{ id: 'prod-1', quantity: 1 }],
          }],
        };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq(
      { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_v3' } },
      'whsec_secret_teste' // = segredo configurado no mock do getConfiguracao
    ));
    expect(res.status).toBe(200);
  });
});
describe('Webhook Asaas — nunca pausa a fila do Asaas (sem 404)', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.notificarStatusPedido.mockReset().mockResolvedValue('ok');
  });

  it('evento desconhecido é reconhecido com 200 e não altera nenhum pedido', async () => {
    const res = await POST(webhookReq({
      event: 'PAYMENT_CREATED',
      payment: { id: 'pay_novo', status: 'PENDING' },
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ignorado).toBe('evento_sem_mapeamento');
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('cobrança sem pedido vinculado responde 200 (antes: 404 pausava a fila)', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) return { rows: [] };
      if (sql.includes('UPDATE public.orders')) return { rows: [] };
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_sem_pedido', status: 'CONFIRMED' },
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ignorado).toBe('pedido_nao_encontrado');
    expect(mocks.notificarStatusPedido).not.toHaveBeenCalled();
  });

  it('reconcilia cobrança órfã pelo externalReference (id do pedido) e grava o vínculo', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM public.orders')) {
        return { rows: [{ status: 'RECEBIDO' }] };
      }
      if (sql.includes('UPDATE public.orders')) {
        return {
          rows: [{
            id: 'pedido-orfao', customer_name: 'A', customer_email: 'a@b.c', status: 'RECEBIDO',
            shipping_method: 'retirada', total_price: 5,
            items: [{ id: 'prod-1', quantity: 1 }],
          }],
        };
      }
      return { rows: [] };
    });

    const res = await POST(webhookReq({
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_orfao', status: 'CONFIRMED', externalReference: 'pedido-orfao' },
    }));

    expect(res.status).toBe(200);
    const update = mocks.query.mock.calls.find(
      (c) => String(c[0]).includes('UPDATE public.orders') && String(c[0]).includes('COALESCE')
    );
    expect(update).toBeTruthy();
    expect(update![1]).toEqual(['APROVADO', 'pay_orfao', 'pedido-orfao']);
    expect(mocks.notificarStatusPedido).toHaveBeenCalledTimes(1);
  });
});
