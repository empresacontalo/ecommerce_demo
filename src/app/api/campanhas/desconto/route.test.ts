import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { _resetRateLimitStore } from '@/utils/rate-limit';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('@/utils/db', () => ({ query: mockQuery }));
vi.mock('@/utils/rate-limit', () => ({ rateLimit: async () => ({ ok: true }), _resetRateLimitStore: () => {}, LIMITES_PADRAO: {}, listarLimites: async () => ({}) }));
vi.mock('@/utils/campanhas-ia', () => ({
  gerarMensagemIA: vi.fn().mockResolvedValue('Olá, Maria! Aproveite a promoção. Confirma seu interesse?'),
}));

describe('Campanha Desconto API (CTA)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    _resetRateLimitStore();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };
    mockQuery.mockReset();
  });

  it('rejeita sem lead_id', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it('404 quando lead não existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ lead_id: 'l1' }),
    }));
    expect(res.status).toBe(404);
  });

  it('gera mensagem e roteia para WhatsApp com wa.me', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'l1', nome: 'Maria', whatsapp: '11999999999', email: null,
          canal_preferido: 'whatsapp', campanha_titulo: 'Dia das Mães',
          desconto: '15%', mensagem_prompt: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ lead_id: 'l1' }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.canal).toBe('whatsapp');
    expect(data.acao).toContain('https://wa.me/5511999999999');

    const insertContato = mockQuery.mock.calls.find((c) => c[0].includes('INSERT INTO public.campanha_contatos'));
    expect(insertContato).toBeTruthy();
    expect(insertContato![0]).toContain("'inicial'");
    expect(insertContato![1][1]).toBe('whatsapp');

    const updateLead = mockQuery.mock.calls.find((c) => c[0].includes('UPDATE public.campanha_leads'));
    expect(updateLead).toBeTruthy();
    expect(updateLead![1][1]).toBe('enviada');
  });

  it('rota para e-mail quando canal_preferido=email e SMTP configurado', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'demo@example.com';
    process.env.SMTP_PASS = 'senha';
    process.env.SMTP_FROM_NAME = 'Loja Teste';

    const sendMail = vi.fn().mockResolvedValue({});
    vi.doMock('nodemailer', () => ({
      createTransport: vi.fn(() => ({ sendMail })),
    }));

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'l1', nome: 'Maria', whatsapp: null, email: 'maria@teste.com',
          canal_preferido: 'email', campanha_titulo: 'Natal',
          desconto: null, mensagem_prompt: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ lead_id: 'l1' }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.canal).toBe('email');
    expect(data.success).toBe(true);
  });
});
