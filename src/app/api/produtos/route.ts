import { query } from '@/utils/db'
import { clausulaOrdemMarcas, getOrdemMarcasEfetiva } from '@/lib/marcas-ordem'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const limit = searchParams.get('limit')
    const exclude = searchParams.get('exclude')

    if (slug) {
      // Fetch single product by slug via direct SQL
      const { rows } = await query('SELECT * FROM produtos WHERE slug = $1 LIMIT 1', [slug])
      
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
      }

      return NextResponse.json(rows[0])
    }

    // Fetch list of products via direct SQL
    let sql = 'SELECT * FROM produtos'
    const params: any[] = []

    if (exclude) {
      sql += ' WHERE id != $1'
      params.push(exclude)
    }

    // Ordem padrão: marcas na ordem configurada no Admin (Lattafa primeiro)
    // e, dentro de cada marca, produtos por nome (A–Z).
    const ordemMarcas = await getOrdemMarcasEfetiva();
    const clausulaMarcas = clausulaOrdemMarcas(ordemMarcas);
    sql += ` ${clausulaMarcas.sql(params.length + 1)}`
    if (ordemMarcas.length > 0) {
      params.push(clausulaMarcas.destaque)
    }

    if (limit) {
      const limitVal = parseInt(limit, 10)
      if (!isNaN(limitVal)) {
        sql += ` LIMIT ${limitVal}`
      }
    }

    const { rows } = await query(sql, params)
    return NextResponse.json(rows)
  } catch (err: any) {
    console.error('Erro inesperado em GET /api/produtos:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
