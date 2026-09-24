import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

// GET /api/cms/galeria — Lista itens da galeria (público)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get('categoria');

    let sql = 'SELECT * FROM public.galeria WHERE ativo = true';
    const params: string[] = [];

    if (categoria) {
      sql += ' AND categoria = $1';
      params.push(categoria);
    }

    sql += ' ORDER BY ordem ASC';

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar galeria:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/galeria — Adicionar imagem (admin)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { url, alt, categoria, ordem } = await req.json();
    if (!url) return NextResponse.json({ error: 'url é obrigatória' }, { status: 400 });

    const result = await query(
      `INSERT INTO public.galeria (url, alt, categoria, ordem)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [url, alt || null, categoria || null, ordem || 0]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao adicionar imagem:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/cms/galeria — Atualizar imagem (admin)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, url, alt, categoria, ordem, ativo } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const result = await query(
      `UPDATE public.galeria
       SET url = COALESCE($2, url), alt = COALESCE($3, alt),
           categoria = COALESCE($4, categoria), ordem = COALESCE($5, ordem), ativo = COALESCE($6, ativo)
       WHERE id = $1 RETURNING *`,
      [id, url || null, alt || null, categoria || null, ordem ?? null, ativo ?? null]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar imagem:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/galeria — Excluir imagem (admin)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    await query('DELETE FROM public.galeria WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir imagem:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
