import { getSession } from '@/utils/auth/jwt'
import { query } from '@/utils/db'

/**
 * Guarda de administrador para API routes.
 * Retorna os dados do admin autenticado e aprovado, ou null.
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

  return { id: session.sub, email: session.email }
}
