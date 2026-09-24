import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/cms/campanhas/[id]/decoracoes — Lista decorações da campanha
export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await query(
      `SELECT * FROM public.campanha_decoracoes WHERE campanha_id = $1 ORDER BY criado_em ASC`,
      [id]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar decorações:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/campanhas/[id]/decoracoes — Adiciona decoração por tipo
export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { tipo, config } = await req.json();
    if (!tipo || typeof tipo !== 'string') {
      return NextResponse.json({ error: 'tipo é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO public.campanha_decoracoes (campanha_id, tipo, config)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, tipo, JSON.stringify(config || {})]
    );
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'decoracao_adicionada',$2,$3)`,
      [id, JSON.stringify({ decoracao_id: result.rows[0].id, tipo }), admin.id]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('Erro ao adicionar decoração:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/campanhas/[id]/decoracoes — Remove decoração
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { decoracao_id } = await req.json();
    if (!decoracao_id) return NextResponse.json({ error: 'decoracao_id é obrigatório' }, { status: 400 });
    await query(
      `DELETE FROM public.campanha_decoracoes WHERE campanha_id = $1 AND id = $2`,
      [id, decoracao_id]
    );
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'decoracao_removida',$2,$3)`,
      [id, JSON.stringify({ decoracao_id }), admin.id]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao remover decoração:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
