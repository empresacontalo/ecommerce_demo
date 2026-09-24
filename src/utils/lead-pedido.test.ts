import { vi, describe, it, expect, beforeEach } from 'vitest';
import { sincronizarLeadComPedido, marcarLeadConvertido, FASES_KANBAN } from './lead-pedido';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('@/utils/db', () => ({ query: mockQuery }));

describe('lead-pedido — kanban automatizado de vendas', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  function chamadas(sqlContem: string) {
    return mockQuery.mock.calls.filter((c) => String(c[0]).includes(sqlContem));
  }

  describe('sincronizarLeadComPedido (checkout com intenção de compra)', () => {
    it('cria lead na fase Interessado quando não existe lead anterior', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO public.leads')) return { rows: [{ id: 'lead-novo', status: 'Interessado', score: 80 }] };
        return { rows: [] };
      });

      const r = await sincronizarLeadComPedido({
        nome: 'Maria Silva',
        email: 'MARIA@x.com',
        telefone: '(11) 99999-9999',
        pedidoId: 'order-1',
      });

      expect(r.ok).toBe(true);
      const ins = chamadas('INSERT INTO public.leads')[0];
      expect(ins ![1]).toEqual(['Maria Silva', '(11) 99999-9999', 'maria@x.com']);
      expect(String(ins![0])).toContain("'Loja', 'Interessado', 80");
      const link = chamadas('UPDATE public.orders')[0];
      expect(link![1]).toEqual(['lead-novo', 'order-1']);
    });

    it('avança lead existente Novo → Interessado e mantém score alto', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM public.leads WHERE')) return { rows: [{ id: 'lead-9', status: 'Novo', score: 50 }] };
        if (sql.includes('UPDATE public.leads')) return { rows: [{ id: 'lead-9', status: 'Interessado', score: 80 }] };
        return { rows: [] };
      });

      const r = await sincronizarLeadComPedido({ nome: 'Ana', telefone: '11999998888', pedidoId: 'order-2' });

      expect(r.ok).toBe(true);
      const up = chamadas('UPDATE public.leads')[0];
      expect(up![1][0]).toBe('Interessado');
      expect(up![1][1]).toBe(80);
      expect(chamadas('INSERT INTO public.leads')).toHaveLength(0);
      // não deve haver pedido de criação para telefone sem DDI (11 dígitos)
      const busca = chamadas('FROM public.leads WHERE')[0];
      expect(busca![1][0]).toEqual(['11999998888', '5511999998888']);
    });

    it('não regride lead que já está em fase mais avançada (Ex: Convertido)', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM public.leads WHERE')) return { rows: [{ id: 'lead-7', status: 'Convertido', score: 90 }] };
        return { rows: [] };
      });

      await sincronizarLeadComPedido({ nome: 'Paulo', email: 'paulo@x.com', pedidoId: 'order-3' });

      const up = chamadas('UPDATE public.leads')[0];
      expect(up![1][0]).toBe('Convertido'); // mantém a fase
      expect(up![1][1]).toBe(90); // mantém score
    });

    it('casando por telefone no formato digitado no site (match por variantes)', async () => {
      let chamouBusca = false;
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM public.leads WHERE')) {
          chamouBusca = true;
          return { rows: [{ id: 'lead-1', status: 'Em Contato', score: 60 }] };
        }
        return { rows: [] };
      });

      await sincronizarLeadComPedido({ nome: 'João', telefone: '(32) 91234-5678', email: 'joao@x.com', pedidoId: 'o-4' });

      expect(chamouBusca).toBe(true);
      const busca = chamadas('FROM public.leads WHERE')[0];
      expect(busca![1][0]).toEqual(['32912345678', '5532912345678']);
      expect(String(busca![0])).toContain('regexp_replace(phone');
      expect(String(busca![0])).toContain('lower(email) = $2');
    });

    it('nunca lança erro: falha do banco não derruba o checkout', async () => {
      mockQuery.mockRejectedValue(new Error('banco fora'));
      const r = await sincronizarLeadComPedido({ nome: 'Fulana', telefone: '11999998888', pedidoId: 'o-5' });
      expect(r.ok).toBe(false);
    });
  });

  describe('marcarLeadConvertido (pagamento confirmado)', () => {
    it('usa o vínculo orders.lead_id para mover o lead para Convertido', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const r = await marcarLeadConvertido({ id: 'pedido-1', lead_id: 'lead-20', customer_phone: '11999999999', customer_email: 'a@b.c' });
      expect(r.ok).toBe(true);
      const up = chamadas('UPDATE public.leads')[0];
      expect(up![1]).toEqual(['lead-20']);
      expect(String(up![0])).toContain("'Convertido'");
    });

    it('para pedidos antigos sem vínculo, encontra o lead por e-mail/telefone', async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM public.leads WHERE')) return { rows: [{ id: 'lead-velho' }] };
        return { rows: [] };
      });
      const r = await marcarLeadConvertido({ id: 'pedido-2', lead_id: null, customer_phone: null, customer_email: 'cliente@x.com' });
      expect(r.ok).toBe(true);
      const up = chamadas('UPDATE public.leads')[0];
      expect(up![1]).toEqual(['lead-velho']);
    });

    it('retorna ok:false sem erro quando não há lead identificável', async () => {
      const r = await marcarLeadConvertido({ id: 'pedido-3', lead_id: null, customer_phone: null, customer_email: null });
      expect(r.ok).toBe(false);
      expect(chamadas('UPDATE public.leads')).toHaveLength(0);
    });
  });

  it('expõe as fases do kanban em ordem de funil', () => {
    expect(Object.values(FASES_KANBAN)).toEqual(['Novo', 'Em Contato', 'Interessado', 'Proposta Enviada', 'Convertido', 'Pós-venda', 'Inativo']);
  });
});