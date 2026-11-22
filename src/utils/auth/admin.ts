import { getSession } from '@/utils/auth/jwt'
import { query } from '@/utils/db'

export const DEMO_READONLY_EMAIL = (
  process.env.DEMO_READONLY_EMAIL || 'demo@aurafragrances.demo'
).trim().toLowerCase()

export function isReadOnlyEmail(email?: string | null): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === DEMO_READONLY_EMAIL
}

/**
 * Guarda de administrador para API routes.
 * Retorna os dados do admin autenticado e aprovado (incluindo flag readOnly), ou null.
 */
export async function getAdminSession() {
  const session = await getSession()
  if (!session?.sub) return null

  const { rows } = await query(
    'SELECT status FROM public.admin_users WHERE id = $1',
    [session.sub]
  )

  const admin = rows[0]
  if (!admin || admin.status !== 'approved') return null

  const readOnly = session.role === 'readonly' || isReadOnlyEmail(session.email)
  return { id: session.sub, email: session.email, readOnly }
}
