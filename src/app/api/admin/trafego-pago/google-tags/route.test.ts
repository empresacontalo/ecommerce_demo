import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, PUT, DELETE } from './route';

const { mockQuery, mockAdmin, mockAudit } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockAdmin: vi.fn(),
  mockAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/db', () => ({ query: mockQuery }));
vi.mock('@/utils/auth/admin', () => ({ getAdminSession: mockAdmin }));
vi.mock('@/utils/audit', () => ({ registrarAuditoria: mockAudit }));

type Req = Parameters<typeof PUT>[0];

function req(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/admin/trafego-pago/google-tags', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Req;
}

const ADMIN = { id: 'admin-1', email: 'admin@example.com' };

const TAG_DB = {
  id: '25a90650-f3b0-4a29-bb95-3933314fca7e',
  nome: 'Google Analytics 4',
  tipo: 'ga4',
  identificador: 'G-8KJZC5J14S',
  codigo: null,
  paginas: ['todas'],
  ativo: true,
  ordem: 0,
  criado_em: '2026-09-11T00:00:00Z',
  atualizado_em: '2026-09-11T00:00:00Z',
};

beforeEach(() => {
  mockQuery.mockReset();
  mockAdmin.mockReset();
  mockAudit.mockClear();
});

describe('GET /api/admin/trafego-pago/google-tags', () => {
  it('401 sem sessão de admin', async () => {
    mockAdmin.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 devolve tags, páginas disponíveis e tipos', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    mockQuery.mockResolvedValue({ rows: [TAG_DB] });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.tags).toHaveLength(1);
    expect(data.tags[0].identificador).toBe('G-8KJZC5J14S');
    expect(data.paginas.map((p: { slug: string }) => p.slug)).toContain('todas');
    expect(data.tipos.map((t: { valor: string }) => t.valor)).toContain('personalizado');
  });
});

describe('POST /api/admin/trafego-pago/google-tags', () => {
  it('401 sem sessão de admin', async () => {
    mockAdmin.mockResolvedValue(null);
    const res = await POST(req({}));
    expect(res.status).toBe(401);
  });

  it('400 quando o identificador não bate com o tipo', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    const res = await POST(req({ nome: 'Tag', tipo: 'ga4', identificador: 'GTM-ABC123', paginas: ['todas'] }));
    expect(res.status).toBe(400);
  });

  it('201 cria normalizando identificador e páginas', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    mockQuery.mockResolvedValueOnce({ rows: [TAG_DB] });

    const res = await POST(req({ nome: 'GA4', tipo: 'ga4', identificador: 'g-8kjzc5j14s', paginas: ['home'] }));
    expect(res.status).toBe(201);

    const insert = mockQuery.mock.calls[0];
    expect(insert[0]).toContain('INSERT INTO public.google_tags');
    expect(insert[1][2]).toBe('G-8KJZC5J14S');
    expect(insert[1][4]).toEqual(['home']);
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });
});

describe('PUT /api/admin/trafego-pago/google-tags', () => {
  it('400 com id ausente ou inválido', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    const res = await PUT(req({ ativo: false }, 'PUT'));
    expect(res.status).toBe(400);
  });

  it('404 quando a tag não existe', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await PUT(req({ id: TAG_DB.id, ativo: false }, 'PUT'));
    expect(res.status).toBe(404);
  });

  it('200 ativa/desativa usando merge com o registro atual', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    mockQuery
      .mockResolvedValueOnce({ rows: [TAG_DB] })
      .mockResolvedValueOnce({ rows: [{ ...TAG_DB, ativo: false }] });

    const res = await PUT(req({ id: TAG_DB.id, ativo: false }, 'PUT'));
    expect(res.status).toBe(200);

    const update = mockQuery.mock.calls[1];
    expect(update[0]).toContain('UPDATE public.google_tags');
    expect(update[1][6]).toBe(false);
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it('400 ao trocar o tipo para um identificador incompatível', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    mockQuery.mockResolvedValueOnce({ rows: [TAG_DB] });

    const res = await PUT(req({ id: TAG_DB.id, tipo: 'gtm' }, 'PUT'));
    expect(res.status).toBe(400);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/admin/trafego-pago/google-tags', () => {
  it('400 sem id', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    const res = await DELETE(req({}, 'DELETE'));
    expect(res.status).toBe(400);
  });

  it('200 remove a tag e registra auditoria', async () => {
    mockAdmin.mockResolvedValue(ADMIN);
    mockQuery.mockResolvedValueOnce({ rows: [{ nome: 'GA4', tipo: 'ga4' }] });

    const res = await DELETE(req({ id: TAG_DB.id }, 'DELETE'));
    expect(res.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });
});
