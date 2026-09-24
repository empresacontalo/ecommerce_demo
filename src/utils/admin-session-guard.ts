'use client'

import { saveDraft, serializeBody, BODY_NOT_SERIALIZABLE } from './admin-draft'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let installed = false
let redirecting = false
let originalFetch: typeof fetch | null = null

/** URLs de escrita protegidas por admin (as que devolvem 401 com sessão expirada). */
function isAuthedWriteUrl(url: string): boolean {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    return u.pathname.startsWith('/api/admin/') || u.pathname.startsWith('/api/cms/')
  } catch {
    return false
  }
}

function getPathname(input: RequestInfo | URL): string {
  try {
    const raw =
      typeof input === 'string' ? input : input instanceof Request ? input.url : input.href
    return new URL(raw, window.location.origin).pathname
  } catch {
    return typeof input === 'string' ? input : ''
  }
}

function getMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

/**
 * Referência ao fetch original (não-patchado), usada pelo replay do draft
 * para que a reprodução do save não dispare o próprio interceptor.
 */
export function getOriginalFetch(): typeof fetch {
  return originalFetch ?? globalThis.fetch
}

/**
 * Instala um guard de sessão no admin: intercepta respostas 401 de escritas
 * autenticadas (/api/admin/* e /api/cms/*), salva a requisição como draft e
 * redireciona para o login informando que a sessão expirou.
 *
 * Retorna uma função de limpeza (restaura o fetch original).
 */
export function installAdminSessionGuard(): () => void {
  if (typeof window === 'undefined' || installed || !window.fetch) return () => {}

  installed = true
  originalFetch = window.fetch.bind(window)

  const patchedFetch: typeof fetch = (input, init) => {
    const promise = originalFetch!(input, init)

    promise
      .then((response) => {
        if (response.status !== 401) return
        const path = getPathname(input)
        if (!isAuthedWriteUrl(path)) return
        if (!WRITE_METHODS.has(getMethod(input, init))) return

        const body = serializeBody(init?.body)
        if (body !== BODY_NOT_SERIALIZABLE) {
          saveDraft(
            path,
            getMethod(input, init),
            body,
            window.location.pathname + window.location.search,
          )
        }

        if (!redirecting) {
          redirecting = true
          window.location.assign('/auth/login?reason=session')
        }
      })
      .catch(() => {
        // falha de rede no then — deixa o fluxo normal da página decidir
      })

    return promise
  }

  window.fetch = patchedFetch

  return () => {
    if (installed) {
      installed = false
      if (window.fetch === patchedFetch && originalFetch) {
        window.fetch = originalFetch
      }
    }
  }
}

/** Zera o flag de redirect (usado em testes). */
export function resetRedirectFlagForTests(): void {
  redirecting = false
}