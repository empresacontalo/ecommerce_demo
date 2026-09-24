import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/environment/operations/:id — status sem payload/segredos
export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await query(
      `SELECT id, status, impact, public_diff_metadata, controller_operation_id,
              error_code, confirmation_at, created_at, updated_at
       FROM public.environment_change_requests
       WHERE id = $1 AND actor_id = $2`,
      [id, admin.id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Operação não encontrada' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('[Environment] operation status error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
