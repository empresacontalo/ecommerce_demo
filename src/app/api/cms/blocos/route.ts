import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria } from '@/utils/audit';

// GET /api/cms/blocos?pagina_id=UUID — Lista blocos de uma página (admin)
// GET /api/cms/blocos?id=UUID — Retorna um bloco específico
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paginaId = searchParams.get('pagina_id');
    const id = searchParams.get('id');

    if (id) {
      const result = await query(
        `SELECT * FROM public.blocos WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Bloco não encontrado' }, { status: 404 });
      }
      return NextResponse.json(result.rows[0]);
    }

    if (paginaId) {
      const result = await query(
        `SELECT * FROM public.blocos
         WHERE pagina_id = $1
         ORDER BY ordem ASC`,
        [paginaId]
      );
      return NextResponse.json(result.rows);
    }

    return NextResponse.json({ error: 'pagina_id ou id é obrigatório' }, { status: 400 });
  } catch (err) {
    console.error('Erro ao buscar blocos:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/blocos — Criar novo bloco (admin)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { pagina_id, tipo, titulo, ordem, conteudo } = await req.json();

    if (!pagina_id || !tipo) {
      return NextResponse.json({ error: 'pagina_id e tipo são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO public.blocos (pagina_id, tipo, titulo, ordem, conteudo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [pagina_id, tipo, titulo || null, ordem || 0, JSON.stringify(conteudo || {})]
    );

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'conteudo',
      resumo: 'Seção de conteúdo criada',
      detalhe: `Um novo bloco de conteúdo "${titulo || tipo || 'sem título'}" foi adicionado a uma página do site.`,
    }, req);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao criar bloco:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/cms/blocos — Atualizar bloco (admin)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, tipo, titulo, ordem, conteudo, ativo } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `UPDATE public.blocos
       SET tipo = COALESCE($2, tipo),
           titulo = COALESCE($3, titulo),
           ordem = COALESCE($4, ordem),
           conteudo = COALESCE($5::jsonb, conteudo),
           ativo = COALESCE($6, ativo)
       WHERE id = $1 RETURNING *`,
      [id, tipo || null, titulo || null, ordem ?? null, conteudo ? JSON.stringify(conteudo) : null, ativo ?? null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Bloco não encontrado' }, { status: 404 });
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'conteudo',
      resumo: 'Seção de conteúdo atualizada',
      detalhe: `O conteúdo "${result.rows[0].titulo || 'de uma seção'}" foi editado ou reordenado.`,
    }, req);

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar bloco:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/blocos — Excluir bloco (admin)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const antes = await query('SELECT titulo FROM public.blocos WHERE id = $1', [id]);
    const titulo = antes.rows[0]?.titulo || 'de uma seção';

    await query(`DELETE FROM public.blocos WHERE id = $1`, [id]);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'conteudo',
      resumo: 'Seção de conteúdo excluída',
      detalhe: `O conteúdo "${titulo}" foi removido de uma página do site.`,
    }, req);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir bloco:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
