import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria } from '@/utils/audit';

// GET /api/cms/paginas — Lista todas as páginas (admin)
// GET /api/cms/paginas?slug=home — Retorna uma página com seus blocos (público)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (slug) {
      // Buscar página + blocos ordenados
      const paginaResult = await query(
        `SELECT * FROM public.paginas WHERE slug = $1 AND ativo = true`,
        [slug]
      );

      if (paginaResult.rows.length === 0) {
        return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
      }

      const pagina = paginaResult.rows[0];

      const blocosResult = await query(
        `        SELECT * FROM public.blocos
         WHERE pagina_id = $1 AND ativo = true
         ORDER BY ordem ASC`,
        [pagina.id]
      );

      return NextResponse.json({
        pagina,
        blocos: blocosResult.rows,
      });
    }

    // Sem slug: listar todas as páginas
    const result = await query(
      `SELECT * FROM public.paginas ORDER BY titulo ASC`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar páginas:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/paginas — Criar nova página (admin)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { slug, titulo, meta_description } = await req.json();

    if (!slug || !titulo) {
      return NextResponse.json({ error: 'slug e titulo são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO public.paginas (slug, titulo, meta_description)
       VALUES ($1, $2, $3) RETURNING *`,
      [slug, titulo, meta_description || null]
    );

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'pagina',
      resumo: 'Página criada',
      detalhe: `Uma nova página chamada "${titulo}" foi criada no site.`,
    }, req);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao criar página:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/cms/paginas — Atualizar página (admin)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, slug, titulo, meta_description, ativo } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `UPDATE public.paginas
       SET slug = COALESCE($2, slug),
           titulo = COALESCE($3, titulo),
           meta_description = COALESCE($4, meta_description),
           ativo = COALESCE($5, ativo)
       WHERE id = $1 RETURNING *`,
      [id, slug || null, titulo || null, meta_description || null, ativo ?? null]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'pagina',
      resumo: 'Página atualizada',
      detalhe: `A página "${result.rows[0].titulo || titulo || 'sem título'}" foi editada (título, endereço ou visibilidade).`,
    }, req);

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar página:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/paginas — Excluir página (admin)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const antes = await query('SELECT titulo FROM public.paginas WHERE id = $1', [id]);
    const titulo = antes.rows[0]?.titulo || 'sem título';

    await query(`DELETE FROM public.paginas WHERE id = $1`, [id]);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'pagina',
      resumo: 'Página excluída',
      detalhe: `A página "${titulo}" foi removida do site.`,
    }, req);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir página:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
