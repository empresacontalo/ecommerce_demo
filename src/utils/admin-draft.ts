'use client'

export const DRAFT_KEY = 'fragrance_admin_draft_v1'
export const DRAFT_RESULT_KEY = 'fragrance_admin_draft_result_v1'

export interface AdminDraft {
  url: string
  method: string
  body: string | null
  path: string
  savedAt: number
}

export interface ReplayResult {
  ok: boolean
  status: number
  error?: string
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Sinaliza body não serializável (FormData/Blob/stream) — não gera draft. */
export const BODY_NOT_SERIALIZABLE = Symbol('BODY_NOT_SERIALIZABLE')

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

function defaultLocalStore(): StorageLike | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

function defaultSessionStore(): StorageLike | null {
  return typeof sessionStorage !== 'undefined' ? sessionStorage : null
}

export function parseDraft(raw: string | null): AdminDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<AdminDraft>
    if (typeof d.url !== 'string' || !d.url) return null
    const method = typeof d.method === 'string' ? d.method.toUpperCase() : ''
    if (!WRITE_METHODS.includes(method)) return null
    return {
      url: d.url,
      method,
      body:
        typeof d.body === 'string'
          ? d.body
          : d.body === null || d.body === undefined
            ? null
            : JSON.stringify(d.body),
      path: typeof d.path === 'string' && d.path ? d.path : '/admin',
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Serializa o body de um RequestInit para o draft.
 * Retorna a string a ser armazenada; `null` se não há body;
 * `BODY_NOT_SERIALIZABLE` se o body existe mas não pode ir para localStorage.
 */
export function serializeBody(
  body: BodyInit | null | undefined,
): string | null | typeof BODY_NOT_SERIALIZABLE {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  return BODY_NOT_SERIALIZABLE
}

export function saveDraft(
  url: string,
  method: string,
  body: string | null,
  path: string,
  store: StorageLike | null = defaultLocalStore(),
): void {
  if (!store) return
  const draft: AdminDraft = { url, method, body, path, savedAt: Date.now() }
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // storage indisponível/cheio — segue sem draft
  }
}

export function getDraft(store: StorageLike | null = defaultLocalStore()): AdminDraft | null {
  if (!store) return null
  try {
    return parseDraft(store.getItem(DRAFT_KEY))
  } catch {
    return null
  }
}

export function clearDraft(store: StorageLike | null = defaultLocalStore()): void {
  if (!store) return
  try {
    store.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

/** Registra a notificação pós-login "dados salvos" / "falha ao salvar". */
export function setDraftResult(ok: boolean, store: StorageLike | null = defaultSessionStore()): void {
  if (!store) return
  try {
    store.setItem(DRAFT_RESULT_KEY, ok ? 'ok' : 'erro')
  } catch {
    // ignore
  }
}

/** Lê (e remove) a notificação pendente. */
export function consumeDraftResult(
  store: StorageLike | null = defaultSessionStore(),
): 'ok' | 'erro' | null {
  if (!store) return null
  try {
    const value = store.getItem(DRAFT_RESULT_KEY)
    if (!value) return null
    store.removeItem(DRAFT_RESULT_KEY)
    return value === 'ok' ? 'ok' : 'erro'
  } catch {
    return null
  }
}

/**
 * Reproduz a escrita pendente com a sessão já renovada.
 * Usa `fetchImpl` injetável (o interceptor NÃO intercepta o próprio replay).
 * O draft é sempre removido após a tentativa, para não haver loop de replays.
 */
export async function replayDraft(
  draft: AdminDraft | null = getDraft(),
  fetchImpl: typeof fetch = globalThis.fetch,
  store: StorageLike | null = defaultLocalStore(),
): Promise<ReplayResult> {
  if (!draft) return { ok: false, status: 0, error: 'Sem alterações pendentes' }
  try {
    let res: Response
    if (draft.body === null) {
      res = await fetchImpl(draft.url, { method: draft.method })
    } else {
      res = await fetchImpl(draft.url, {
        method: draft.method,
        headers: { 'Content-Type': 'application/json' },
        body: draft.body,
      })
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, status: res.status, error: data?.error || `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'Erro de rede' }
  } finally {
    clearDraft(store)
  }
}