import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria } from '@/utils/audit';

// GET /api/admin/carrossel — Retorna o bloco carrossel da home (slides)
export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { rows } = await query(
      `SELECT b.id, b.titulo, b.ordem, b.ativo, b.conteudo
       FROM public.blocos b
       JOIN public.paginas p ON p.id = b.pagina_id
       WHERE p.slug = 'home' AND b.tipo = 'carrossel'
       ORDER BY b.ordem ASC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Bloco de carrossel não encontrado na home' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('Erro ao buscar carrossel:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/admin/carrossel — Atualiza os slides do carrossel da home
export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { slides, titulo, ativo } = body;

    if (!Array.isArray(slides)) {
      return NextResponse.json({ error: 'slides deve ser um array' }, { status: 400 });
    }

    const { rows } = await query(
      `SELECT b.id
       FROM public.blocos b
       JOIN public.paginas p ON p.id = b.pagina_id
       WHERE p.slug = 'home' AND b.tipo = 'carrossel'
       ORDER BY b.ordem ASC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Bloco de carrossel não encontrado na home' }, { status: 404 });
    }

    const blocoId = rows[0].id;
    const result = await query(
      `UPDATE public.blocos
       SET conteudo = $2::jsonb,
           titulo = COALESCE($3, titulo),
           ativo = COALESCE($4, ativo)
       WHERE id = $1 RETURNING *`,
      [blocoId, JSON.stringify({ slides }), titulo || null, ativo ?? null]
    );

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'conteudo',
      resumo: 'Carrossel da página inicial atualizado',
      detalhe: 'Os banners de destaque da página inicial (imagens, textos e botões) foram alterados.',
    }, req);

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error('Erro ao salvar carrossel:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}