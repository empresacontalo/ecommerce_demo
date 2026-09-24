import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { obterTokenTexto } from '@/lib/mcp/tokens';

// POST /api/admin/mcp-tokens/copy — Retorna o token em texto (para copiar)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    const token = await obterTokenTexto(id);
    return NextResponse.json({ token });
  } catch (err) {
    console.error('[mcp-tokens] COPY:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' }, { status: 400 });
  }
}