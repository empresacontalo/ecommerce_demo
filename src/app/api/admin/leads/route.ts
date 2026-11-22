import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET() {
  try {
    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await query(
      'SELECT * FROM public.leads ORDER BY created_at DESC'
    )

    const safeRows = admin.readOnly
      ? rows.map((r: any) => ({
          ...r,
          email: r.email ? String(r.email).replace(/(^.).*(@.*$)/, '$1***$2') : null,
          phone: r.phone ? '***-***-' + String(r.phone).slice(-4) : null,
        }))
      : rows

    return NextResponse.json(safeRows)
  } catch (err: any) {
    console.error('Erro inesperado na API Admin Leads:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/admin/leads — Cria um lead manualmente no painel
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, phone, email, instagram, source, status, score } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if (!phone || String(phone).replace(/\D/g, '').length < 8) {
      return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
    }

    const { rows } = await query(
      `INSERT INTO public.leads (name, phone, email, instagram, source, status, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        String(name).trim(),
        String(phone).trim(),
        email?.trim() || null,
        instagram?.trim() || null,
        source || 'Manual',
        status || 'Novo',
        Math.max(0, Math.min(100, Number(score) || 0)),
      ]
    )

    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    console.error('Erro ao criar lead:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
