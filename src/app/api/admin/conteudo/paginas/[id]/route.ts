import { NextResponse } from 'next/server'
import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { titulo, meta_description, ativo } = body

    const { rows } = await query(
      `UPDATE public.paginas
       SET titulo = COALESCE($1, titulo),
           meta_description = COALESCE($2, meta_description),
           ativo = COALESCE($3, ativo)
       WHERE id = $4
       RETURNING id, slug, titulo, meta_description, ativo`,
      [titulo, meta_description, ativo, id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 })
    }

    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
