import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

// GET /api/admin/agendamentos?status=&busca= — Lista agendamentos
// GET /api/admin/agendamentos?stats=1 — Estatísticas (hoje/semana/confirmados/no-show)
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || '').trim();
    const busca = (searchParams.get('busca') || '').trim();

    if (searchParams.get('stats') === '1') {
      const stats = await query(
        `SELECT
           COUNT(*) FILTER (WHERE scheduled_at::date = CURRENT_DATE) AS hoje,
           COUNT(*) FILTER (WHERE scheduled_at >= date_trunc('week', CURRENT_DATE)) AS semana,
           COUNT(*) FILTER (WHERE status = 'Confirmado') AS confirmados,
           COUNT(*) FILTER (WHERE status = 'Não Compareceu') AS no_show,
           COUNT(*) FILTER (WHERE status <> 'Cancelado') AS ativos
         FROM public.agendamentos`
      );
      return NextResponse.json(stats.rows[0]);
    }

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status && status !== 'Todos') {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    if (busca) {
      params.push(`%${busca}%`);
      conds.push(`(client_name ILIKE $${params.length} OR client_phone ILIKE $${params.length} OR service ILIKE $${params.length})`);
    }
    let sql = 'SELECT * FROM public.agendamentos';
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ' ORDER BY scheduled_at ASC LIMIT 500';

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar agendamentos:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/admin/agendamentos — Cria agendamento
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { client_name, client_phone, service, scheduled_at, status, notes, price } = await req.json();
    if (!client_name || !client_phone || !service || !scheduled_at) {
      return NextResponse.json({ error: 'client_name, client_phone, service e scheduled_at são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO public.agendamentos (client_name, client_phone, service, scheduled_at, status, notes, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [client_name, client_phone, service, scheduled_at, status || 'Pendente', notes || null, price ?? null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/admin/agendamentos — Atualiza agendamento
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, client_name, client_phone, service, scheduled_at, status, notes, price } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const result = await query(
      `UPDATE public.agendamentos
       SET client_name = COALESCE($2, client_name),
           client_phone = COALESCE($3, client_phone),
           service = COALESCE($4, service),
           scheduled_at = COALESCE($5, scheduled_at),
           status = COALESCE($6, status),
           notes = COALESCE($7, notes),
           price = COALESCE($8, price)
       WHERE id = $1 RETURNING *`,
      [id, client_name || null, client_phone || null, service || null, scheduled_at || null, status || null, notes ?? null, price ?? null]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar agendamento:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/admin/agendamentos — Exclui agendamento
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    await query('DELETE FROM public.agendamentos WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir agendamento:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
