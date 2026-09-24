'use client'

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

let clientInstance: ReturnType<typeof buildClient> | null = null

/**
 * Substitui createBrowserClient do @supabase/ssr.
 * Mantém interface compatível: cada método faz fetch() para as API routes de auth.
 * Singleton: devolve a MESMA instância a cada chamada — componentes que usam
 * `createClient()` como dependência de useEffect não podem re-executar em loop
 * (causa raiz de centenas de chamadas a /api/auth/me por página).
 */
export function createClient(): ReturnType<typeof buildClient> {
  if (!clientInstance) {
    clientInstance = buildClient()
  }
  return clientInstance
}

function buildClient() {
  const baseUrl = getBaseUrl()

  return {
    auth: {
      /**
       * Login com email e senha.
       * Compatível com: supabase.auth.signInWithPassword({ email, password })
       */
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const data = await res.json()
          if (!res.ok) {
            return { data: null, error: { message: data.error || 'Login failed' } }
          }
          return { data: { user: data.user }, error: null }
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Network error' } }
        }
      },

      /**
       * Registro de novo usuário.
       * Compatível com: supabase.auth.signUp({ email, password, options: { data: {...} } })
       */
      async signUp({ email, password, options }: {
        email: string
        password: string
        options?: { data?: { name?: string; full_name?: string; cpf?: string; phone?: string; is_admin_request?: boolean } }
      }) {
        try {
          const res = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              name: options?.data?.name || options?.data?.full_name,
              cpf: options?.data?.cpf,
              phone: options?.data?.phone,
              is_admin_request: options?.data?.is_admin_request,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            return { data: null, error: { message: data.error || 'Registration failed' } }
          }
          return { data: { user: data.user }, error: null }
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Network error' } }
        }
      },

      /**
       * Login com Google OAuth.
       * Compatível com: supabase.auth.signInWithOAuth({ provider: 'google', options: {...} })
       */
      async signInWithOAuth({ provider, options }: {
        provider: string
        options?: { redirectTo?: string; queryParams?: Record<string, string> }
      }) {
        if (provider !== 'google') {
          return { error: { message: `Provider ${provider} not supported` } }
        }

        try {
          const next = options?.redirectTo || '/'
          // Redirect para a API route que inicia o fluxo OAuth
          window.location.href = `${baseUrl}/api/auth/google?next=${encodeURIComponent(next)}`
          return { error: null }
        } catch (err: any) {
          return { error: { message: err.message || 'OAuth redirect failed' } }
        }
      },

      /**
       * Logout.
       * Compatível com: supabase.auth.signOut()
       */
      async signOut() {
        try {
          await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
          return { error: null }
        } catch (err: any) {
          return { error: { message: err.message || 'Logout failed' } }
        }
      },

      /**
       * Recuperação de senha.
       * Compatível com: supabase.auth.resetPasswordForEmail(email, { redirectTo })
       */
      async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
        try {
          const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = await res.json()
          if (!res.ok) {
            return { data: null, error: { message: data.error || 'Reset password failed' } }
          }
          return { data: {}, error: null }
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Network error' } }
        }
      },

      /**
       * Atualizar usuário (senha ou metadados).
       * Compatível com: supabase.auth.updateUser({ password, data })
       */
      async updateUser(attrs: { password?: string; data?: Record<string, any> }) {
        try {
          if (attrs.password) {
            // Password update - requires reset token
            // For the "atualizar-senha" flow, this is handled by the reset-password/update-password routes
            return { data: { user: null }, error: { message: 'Use the password reset flow' } }
          }

          if (attrs.data) {
            // Metadata update (profile)
            const res = await fetch(`${baseUrl}/api/auth/me`)
            if (!res.ok) {
              return { data: null, error: { message: 'Not authenticated' } }
            }
            return { data: { user: (await res.json()).user }, error: null }
          }

          return { data: { user: null }, error: { message: 'No attributes to update' } }
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Update failed' } }
        }
      },

      /**
       * Obter usuário da sessão atual.
       * Compatível com: supabase.auth.getUser()
       */
      async getUser() {
        try {
          const res = await fetch(`${baseUrl}/api/auth/me`)
          if (!res.ok) {
            return { data: { user: null } }
          }
          const data = await res.json()
          return { data: { user: data.user }, error: null }
        } catch {
          return { data: { user: null }, error: null }
        }
      },

      /**
       * Listener de mudanças de estado de auth (stub).
       * Compatível com: supabase.auth.onAuthStateChange(callback)
       */
      onAuthStateChange(_callback: (event: string, session: any) => void) {
        // Stub — sem WebSocket, não há eventos em tempo real
        return {
          data: {
            subscription: { unsubscribe: () => {} },
          },
        }
      },
    },
  }
}
