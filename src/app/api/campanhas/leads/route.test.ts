import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { _resetRateLimitStore } from '@/utils/rate-limit';

const { mockQuery, mockGetConfiguracao } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockResolvedValue({ rows: [] }),
  mockGetConfiguracao: vi.fn().mockResolvedValue({ valor: 'https://chat.digitalarea.online' }),
}));

vi.mock('@/utils/db', () => ({ query: mockQuery }));
vi.mock('@/utils/rate-limit', () => ({ rateLimit: async () => ({ ok: true }), _resetRateLimitStore: () => {}, LIMITES_PADRAO: {}, listarLimites: async () => ({}) }));
vi.mock('@/app/actions/cms', () => ({ getConfiguracao: mockGetConfiguracao }));

describe('Campanha Leads API (público)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    _resetRateLimitStore();
    process.env = { ...originalEnv };
    mockQuery.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejeita sem campanha_id', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Maria' }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejeita sem nome', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ campanha_id: 'c1' }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejeita sem whatsapp e sem email', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ campanha_id: 'c1', nome: 'Maria' }),
    }));
    expect(res.status).toBe(400);
  });

  it('rejeita preferencia_lembrete inválida', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ campanha_id: 'c1', nome: 'Maria', whatsapp: '11999999999', preferencia_lembrete: 'x' }),
    }));
    expect(res.status).toBe(400);
  });

  it('404 quando campanha não está ativa', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ campanha_id: 'c1', nome: 'Maria', whatsapp: '11999999999' }),
    }));
    expect(res.status).toBe(404);
  });

  it('insere lead + familiares + histórico (sucesso)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({
        campanha_id: 'c1',
        nome: 'Maria Silva',
        whatsapp: '(11) 99999-9999',
        email: 'MARIA@TESTE.COM',
        nascimento: '1990-01-01',
        data_especial: '2026-12-25',
        preferencia_lembrete: 'ambos',
        canal_preferido: 'whatsapp',
        familiares: [{ nome: 'João', whatsapp: '(11) 98888-8888', data_especial: '2026-05-10' }],
      }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.lead_id).toBe('lead-1');

    const insertLead = mockQuery.mock.calls.find((c) => c[0].includes('INSERT INTO public.campanha_leads'));
    expect(insertLead).toBeTruthy();
    expect(insertLead![1][0]).toBe('c1');
    expect(insertLead![1][1]).toBe('Maria Silva');
    expect(insertLead![1][2]).toBe('5511999999999');
    expect(insertLead![1][3]).toBe('maria@teste.com');

    const insertFam = mockQuery.mock.calls.find((c) => c[0].includes('INSERT INTO public.campanha_familiares'));
    expect(insertFam).toBeTruthy();
    expect(insertFam![1][1]).toBe('João');
    expect(insertFam![1][2]).toBe('5511988888888');

    const insertHist = mockQuery.mock.calls.find((c) => c[0].includes('INSERT INTO public.campanha_historico'));
    expect(insertHist).toBeTruthy();
  });
});
