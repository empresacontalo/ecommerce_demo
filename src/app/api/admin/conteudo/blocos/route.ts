import { NextResponse } from 'next/server'
import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const paginaId = url.searchParams.get('pagina_id')

    if (!paginaId) {
      return NextResponse.json({ error: 'pagina_id é obrigatório' }, { status: 400 })
    }

    const { rows } = await query(
      'SELECT id, pagina_id, tipo, titulo, ordem, conteudo, ativo, created_at, updated_at FROM public.blocos WHERE pagina_id = $1 ORDER BY ordem',
      [paginaId]
    )

    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { id, pagina_id, tipo, titulo, ordem, conteudo, ativo } = body

    if (!pagina_id) {
      return NextResponse.json({ error: 'pagina_id é obrigatório' }, { status: 400 })
    }

    let result
    if (id) {
      // Update existing block
      result = await query(
        `UPDATE public.blocos
         SET tipo = COALESCE($1, tipo),
             titulo = COALESCE($2, titulo),
             ordem = COALESCE($3, ordem),
             conteudo = COALESCE($4, conteudo),
             ativo = COALESCE($5, ativo),
             updated_at = NOW()
         WHERE id = $6 AND pagina_id = $7
         RETURNING id, pagina_id, tipo, titulo, ordem, conteudo, ativo, updated_at`,
        [tipo, titulo, ordem, JSON.stringify(conteudo), ativo, id, pagina_id]
      )
    } else {
      // Create new block
      result = await query(
        `INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo, ativo)
         VALUES ($1, COALESCE($2, 'hero'), $3, COALESCE($4, 0), COALESCE($5, '{}'::jsonb), COALESCE($6, true))
         RETURNING id, pagina_id, tipo, titulo, ordem, conteudo, ativo, created_at, updated_at`,
        [pagina_id, tipo, titulo, ordem, JSON.stringify(conteudo || {}), ativo]
      )
    }

    return NextResponse.json(result.rows[0], { status: id ? 200 : 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
