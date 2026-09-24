import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/cms/campanhas/[id]/imagens — Lista imagens da campanha
export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await query(
      `SELECT * FROM public.campanha_imagens WHERE campanha_id = $1 ORDER BY ordem ASC, criada_em ASC`,
      [id]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar imagens:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/campanhas/[id]/imagens — Adiciona imagem (upload/base64 ou URL)
// Novas imagens entram ANTES das existentes (ordem = min - 1)
export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { url, status, criada_por_ia } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url é obrigatória' }, { status: 400 });
    }
    // Aceita link http(s), data URI de imagem e caminhos locais (upload normalizado
    // pelo servidor: /uploads/..., /images/... ou outros caminhos públicos da app).
    if (!/^(https?:\/\/|data:image\/|\/)/.test(url)) {
      return NextResponse.json({ error: 'url deve ser http(s), data:image ou caminho local' }, { status: 400 });
    }
    if (url.length > 2_000_000) {
      return NextResponse.json({ error: 'Imagem muito grande. Máximo ~2MB (base64).' }, { status: 400 });
    }

    const [{ rows: minRows }] = await Promise.all([
      query(`SELECT COALESCE(MIN(ordem), 0) AS min_ordem FROM public.campanha_imagens WHERE campanha_id = $1`, [id]),
    ]);
    const ordem = Number(minRows[0]?.min_ordem ?? 0) - 1;

    const result = await query(
      `INSERT INTO public.campanha_imagens (campanha_id, url, ordem, status, criada_por_ia)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, url, ordem, status || 'aprovada', criada_por_ia ?? false]
    );
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'imagem_adicionada',$2,$3)`,
      [id, JSON.stringify({ imagem_id: result.rows[0].id }), admin.id]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao adicionar imagem:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PATCH /api/cms/campanhas/[id]/imagens — Reordena ou atualiza status (aprovada/rejeitada/ativa)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const { imagem_id, ordem, status, url_paisagem, url_retrato } = body;
    if (!imagem_id) return NextResponse.json({ error: 'imagem_id é obrigatório' }, { status: 400 });

    const sets: string[] = [];
    const vals: unknown[] = [];
    if (typeof ordem === 'number') { sets.push(`ordem = $${vals.length + 1}`); vals.push(ordem); }
    if (status) { sets.push(`status = $${vals.length + 1}`); vals.push(status); }
    if (typeof url_paisagem === 'string') {
      sets.push(`url_paisagem = $${vals.length + 1}`); vals.push(url_paisagem === '' ? null : url_paisagem);
    }
    if (typeof url_retrato === 'string') {
      sets.push(`url_retrato = $${vals.length + 1}`); vals.push(url_retrato === '' ? null : url_retrato);
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    sets.push(`updated_at = NOW()`);
    vals.push(id, imagem_id);

    const result = await query(
      `UPDATE public.campanha_imagens SET ${sets.join(', ')}
       WHERE campanha_id = $${vals.length - 1} AND id = $${vals.length} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });

    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'imagem_atualizada',$2,$3)`,
      [id, JSON.stringify({ imagem_id, ordem, status }), admin.id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar imagem:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/campanhas/[id]/imagens — Exclui imagem
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { imagem_id } = await req.json();
    if (!imagem_id) return NextResponse.json({ error: 'imagem_id é obrigatório' }, { status: 400 });
    await query('DELETE FROM public.campanha_imagens WHERE campanha_id = $1 AND id = $2', [id, imagem_id]);
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'imagem_excluida',$2,$3)`,
      [id, JSON.stringify({ imagem_id }), admin.id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir imagem:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
