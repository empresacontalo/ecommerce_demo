import { getSession } from '@/utils/auth/jwt'

/**
 * Substitui createServerClient do @supabase/ssr.
 * Mantém interface compatível: retorna { auth: { getUser } }
 */
export async function createClient() {
  return {
    auth: {
      async getUser() {
        const session = await getSession()
        if (!session) {
          return {
            data: { user: null },
            error: { message: 'Not authenticated' },
          }
        }
        return {
          data: {
            user: {
              id: session.sub,
              email: session.email,
              role: session.role || 'authenticated',
            },
          },
          error: null,
        }
      },
    },
  }
}
