import { createClient } from '@/utils/auth/server'
import { query } from '@/utils/db'
import { NextResponse } from 'next/server'

// GET: Retrieve all addresses for the logged-in user
export async function GET() {
  try {
    const supabaseUser = await createClient()
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { rows } = await query(
      'SELECT * FROM public.user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [user.id]
    )

    return NextResponse.json(rows)
  } catch (err: any) {
    console.error('Erro inesperado em GET /api/addresses:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}

// POST: Add a new address for the logged-in user
export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Enforce required fields
    if (!body.zip_code || !body.street || !body.number || !body.neighborhood || !body.city || !body.state) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { rows } = await query(
      `INSERT INTO public.user_addresses (zip_code, street, number, complement, neighborhood, city, state, label, is_default, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        body.zip_code,
        body.street,
        body.number,
        body.complement || '',
        body.neighborhood,
        body.city,
        body.state,
        body.label || 'Outro',
        body.is_default || false,
        user.id
      ]
    )

    return NextResponse.json(rows)
  } catch (err: any) {
    console.error('Erro inesperado em POST /api/addresses:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}

// PUT: Update an address (e.g. set default or change labels)
export async function PUT(request: Request) {
  try {
    const supabaseUser = await createClient()
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, is_default, zip_code, street, number, complement, neighborhood, city, state, label } = body

    if (!id) {
      return NextResponse.json({ error: 'ID do endereço não fornecido' }, { status: 400 })
    }

    // Check ownership
    const checkOwner = await query('SELECT 1 FROM public.user_addresses WHERE id = $1 AND user_id = $2', [id, user.id])
    if (checkOwner.rows.length === 0) {
      return NextResponse.json({ error: 'Endereço não encontrado ou não autorizado' }, { status: 404 })
    }

    const { rows } = await query(
      `UPDATE public.user_addresses
       SET zip_code = COALESCE($1, zip_code),
           street = COALESCE($2, street),
           number = COALESCE($3, number),
           complement = COALESCE($4, complement),
           neighborhood = COALESCE($5, neighborhood),
           city = COALESCE($6, city),
           state = COALESCE($7, state),
           label = COALESCE($8, label),
           is_default = COALESCE($9, is_default)
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        zip_code ?? null,
        street ?? null,
        number ?? null,
        complement ?? null,
        neighborhood ?? null,
        city ?? null,
        state ?? null,
        label ?? null,
        is_default ?? null,
        id,
        user.id
      ]
    )

    return NextResponse.json(rows)
  } catch (err: any) {
    console.error('Erro inesperado em PUT /api/addresses:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}

// DELETE: Delete a saved address
export async function DELETE(request: Request) {
  try {
    const supabaseUser = await createClient()
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID do endereço não fornecido' }, { status: 400 })
    }

    const { rowCount } = await query(
      'DELETE FROM public.user_addresses WHERE id = $1 AND user_id = $2',
      [id, user.id]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Endereço não encontrado ou não autorizado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Erro inesperado em DELETE /api/addresses:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
