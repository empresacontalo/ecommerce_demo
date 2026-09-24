import { NextResponse } from 'next/server'
import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { rows } = await query(
      'SELECT id, slug, titulo, meta_description, ativo, created_at FROM public.paginas ORDER BY titulo'
    )
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
