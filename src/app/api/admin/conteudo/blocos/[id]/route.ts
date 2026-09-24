import { NextResponse } from 'next/server'
import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const { rows } = await query(
      'DELETE FROM public.blocos WHERE id = $1 RETURNING id',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Bloco não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
