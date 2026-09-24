import { describe, it, expect, vi } from 'vitest';
import {
  DRAFT_KEY,
  DRAFT_RESULT_KEY,
  parseDraft,
  serializeBody,
  saveDraft,
  getDraft,
  clearDraft,
  setDraftResult,
  consumeDraftResult,
  replayDraft,
  BODY_NOT_SERIALIZABLE,
  type AdminDraft,
  type StorageLike,
} from './admin-draft';

function makeStore(): StorageLike & { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> } {
  return {
    getItem: vi.fn((_key: string): string | null => null),
    setItem: vi.fn((_key: string, _value: string): void => {}),
    removeItem: vi.fn((_key: string): void => {}),
  } as unknown as StorageLike & { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
}

function draftFixture(): AdminDraft {
  return {
    url: '/api/cms/configuracoes',
    method: 'POST',
    body: JSON.stringify({ chave: 'header.logo', valor: { texto: 'Aura' } }),
    path: '/admin/conteudo',
    savedAt: 123,
  };
}

describe('parseDraft', () => {
  it('devolve null para entrada vazia ou inválida', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('')).toBeNull();
    expect(parseDraft('{not json')).toBeNull();
  });

  it('rejeita draft sem url ou com método não-escrita', () => {
    expect(parseDraft(JSON.stringify({ method: 'POST', body: null }))).toBeNull();
    expect(parseDraft(JSON.stringify({ url: '/api/x', method: 'GET' }))).toBeNull();
  });

  it('normaliza método e corpo ausente para null', () => {
    const d = parseDraft(JSON.stringify({ url: '/api/admin/x', method: 'delete' }));
    expect(d).not.toBeNull();
    expect(d!.method).toBe('DELETE');
    expect(d!.body).toBeNull();
    expect(d!.path).toBe('/admin');
  });
});

describe('serializeBody', () => {
  it('serializa string e URLSearchParams, ignora ausente e não-serializável', () => {
    expect(serializeBody(undefined)).toBeNull();
    expect(serializeBody(null)).toBeNull();
    expect(serializeBody('{"a":1}')).toBe('{"a":1}');
    expect(serializeBody(new URLSearchParams({ a: '1' }))).toBe('a=1');
    if (typeof FormData !== 'undefined') {
      expect(serializeBody(new FormData())).toBe(BODY_NOT_SERIALIZABLE);
    }
    expect(serializeBody(new Blob(['x']))).toBe(BODY_NOT_SERIALIZABLE);
  });
});

describe('saveDraft / getDraft / clearDraft', () => {
  it('persiste e recupera o draft', () => {
    const store = makeStore();
    const raw = JSON.stringify(draftFixture());
    store.getItem.mockReturnValue(raw);

    saveDraft('/api/cms/configuracoes', 'POST', '{"x":1}', '/admin/conteudo', store);
    expect(store.setItem).toHaveBeenCalledWith(DRAFT_KEY, expect.stringContaining('"/api/cms/configuracoes"'));

    const d = getDraft(store);
    expect(d).toMatchObject({ url: '/api/cms/configuracoes', method: 'POST', path: '/admin/conteudo' });

    clearDraft(store);
    expect(store.removeItem).toHaveBeenCalledWith(DRAFT_KEY);
  });

  it('retorna null com storage indisponível ou JSON corrompido', () => {
    expect(getDraft(null)).toBeNull();
    saveDraft('/api/x', 'POST', null, '/', null);
    const corrupt = makeStore();
    corrupt.getItem.mockReturnValue('{corrupt');
    expect(getDraft(corrupt)).toBeNull();
  });
});

describe('setDraftResult / consumeDraftResult', () => {
  it('armazena e consome uma única vez', () => {
    const store = makeStore();
    store.getItem.mockReturnValue('ok');
    setDraftResult(true, store);
    expect(store.setItem).toHaveBeenCalledWith(DRAFT_RESULT_KEY, 'ok');
    expect(consumeDraftResult(store)).toBe('ok');
    expect(store.removeItem).toHaveBeenCalledWith(DRAFT_RESULT_KEY);
    store.getItem.mockReturnValue(null);
    expect(consumeDraftResult(store)).toBeNull();
  });
});

describe('replayDraft', () => {
  it('reproduz o POST com body JSON e limpa o draft no sucesso', async () => {
    const store = makeStore();
    store.getItem.mockReturnValue(JSON.stringify(draftFixture()));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const r = await replayDraft(getDraft(store)!, fetchMock, store);

    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledWith('/api/cms/configuracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"chave":"header.logo","valor":{"texto":"Aura"}}',
    });
    expect(store.removeItem).toHaveBeenCalledWith(DRAFT_KEY);
  });

  it('reproduz DELETE sem body', async () => {
    const d: AdminDraft = { url: '/api/admin/users', method: 'DELETE', body: null, path: '/admin/configuracoes/usuarios', savedAt: 1 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const r = await replayDraft(d, fetchMock);
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users', { method: 'DELETE' });
  });

  it('reporta falha HTTP e limpa o draft (sem loop)', async () => {
    const d = draftFixture();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'deu ruim' }), { status: 500 }));
    const r = await replayDraft(d, fetchMock);
    expect(r).toMatchObject({ ok: false, status: 500, error: 'deu ruim' });
  });

  it('reporta 401 (sessão ainda inválida) sem lançar', async () => {
    const d = draftFixture();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 }));
    const r = await replayDraft(d, fetchMock);
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('sem draft retorna erro imediato', async () => {
    const r = await replayDraft(null, vi.fn());
    expect(r.ok).toBe(false);
  });
});