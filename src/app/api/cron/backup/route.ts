import { NextRequest, NextResponse } from 'next/server';
import { executarBackupAutomatico, BACKUP_DIR, BACKUP_RETENTION_DAYS } from '@/lib/backups/auto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/cron/backup?secret=... — Executa backup automático do conteúdo
// (grava arquivo gzip em BACKUP_DIR e remove backups com mais de 7 dias).
// Pode ser chamado por um agendador externo; o agendador interno roda 1x/dia às 00:00.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const resultado = await executarBackupAutomatico();
    return NextResponse.json({
      ok: true,
      pasta: BACKUP_DIR,
      retencao_dias: BACKUP_RETENTION_DAYS,
      ...resultado,
    });
  } catch (err) {
    console.error('[cron/backup] erro:', err);
    return NextResponse.json({ error: 'Falha ao executar backup' }, { status: 500 });
  }
}