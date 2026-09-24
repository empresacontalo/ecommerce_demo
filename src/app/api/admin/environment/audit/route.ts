import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

// GET /api/admin/environment/audit — auditoria redigida
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 100), 1), 500);
    const result = await query(
      `SELECT id, request_id, actor_id, actor_email, action, key_names,
              redacted_metadata, old_fingerprint, new_fingerprint, result, created_at
       FROM public.environment_audit_log
       ORDER BY created_at DESC LIMIT ${limit}`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('[Environment] audit error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
