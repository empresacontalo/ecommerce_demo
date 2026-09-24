import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

// GET /api/cms/depoimentos — Lista depoimentos ativos (público)
export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM public.depoimentos WHERE ativo = true ORDER BY ordem ASC'
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar depoimentos:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/depoimentos — Criar depoimento (admin)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { nome, texto, foto_url, estrelas, ordem } = await req.json();
    if (!nome || !texto) return NextResponse.json({ error: 'nome e texto são obrigatórios' }, { status: 400 });

    const result = await query(
      `INSERT INTO public.depoimentos (nome, texto, foto_url, estrelas, ordem)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, texto, foto_url || null, estrelas || 5, ordem || 0]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao criar depoimento:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/cms/depoimentos — Atualizar depoimento (admin)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, nome, texto, foto_url, estrelas, ordem, ativo } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const result = await query(
      `UPDATE public.depoimentos
       SET nome = COALESCE($2, nome), texto = COALESCE($3, texto),
           foto_url = COALESCE($4, foto_url), estrelas = COALESCE($5, estrelas),
           ordem = COALESCE($6, ordem), ativo = COALESCE($7, ativo)
       WHERE id = $1 RETURNING *`,
      [id, nome || null, texto || null, foto_url || null, estrelas ?? null, ordem ?? null, ativo ?? null]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar depoimento:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/depoimentos — Excluir depoimento (admin)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    await query('DELETE FROM public.depoimentos WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir depoimento:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
