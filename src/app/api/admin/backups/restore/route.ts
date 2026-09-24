import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { criarBackup, obterBackup, restaurarConteudo } from '@/lib/backups/backups';
import { registrarAuditoria } from '@/utils/audit';

// POST /api/admin/backups/restore — Restaura um backup (substitui o conteúdo atual)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    // Segurança: antes de restaurar, guarda o estado atual como backup automático
    const seguranca = await criarBackup('Antes da restauração (automático)', admin.email || admin.id);

    const backup = await obterBackup(id);
    const resultado = await restaurarConteudo(backup.payload);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'backup',
      resumo: 'Backup restaurado',
      detalhe: `O site foi restaurado para a cópia de segurança "${backup.nome}". O conteúdo que existia antes foi guardado automaticamente como nova cópia de segurança.`,
    }, req);

    return NextResponse.json({
      success: true,
      restaurado: { nome: backup.nome, tabelas: resultado.tabelas_restauradas.length, linhas: resultado.linhas },
      backup_seguranca_id: seguranca.id,
    });
  } catch (err) {
    console.error('[backups] RESTORE:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao restaurar backup' }, { status: 500 });
  }
}