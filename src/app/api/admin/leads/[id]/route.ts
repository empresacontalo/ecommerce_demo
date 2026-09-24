import { getAdminSession } from '@/utils/auth/admin'
import { query } from '@/utils/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing ID or status' }, { status: 400 })
    }

    const admin = await getAdminSession()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await query(
      'UPDATE public.leads SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json(rows[0])
  } catch (err: any) {
    console.error('Erro inesperado na API Admin Update Lead:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
