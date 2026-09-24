import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/cms/campanhas/[id]/historico — Histórico de alterações (rastreabilidade)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await query(
      `SELECT * FROM public.campanha_historico WHERE campanha_id = $1 ORDER BY criado_em DESC LIMIT 200`,
      [id]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar histórico:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
