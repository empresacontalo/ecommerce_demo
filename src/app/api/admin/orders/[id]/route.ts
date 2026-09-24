import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/orders/[id] — Detalhe do pedido (com itens)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await query('SELECT * FROM public.orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar pedido:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/admin/orders/[id] — Exclui pedido
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await query('DELETE FROM public.orders WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir pedido:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
