import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { obterBackup, compactarPayload } from '@/lib/backups/backups';

// GET /api/admin/backups/[id]/download — Baixa o backup comprimido (gzip)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const backup = await obterBackup(id);
    const dados = compactarPayload(backup.payload);
    const nomeArquivo = `backup-${id.slice(0, 8)}.backup.json.gz`;
    return new NextResponse(new Uint8Array(dados), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Content-Length': String(dados.length),
      },
    });
  } catch (err) {
    console.error('[backups] DOWNLOAD:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' }, { status: 400 });
  }
}