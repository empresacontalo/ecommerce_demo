import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { criarBackup, listarBackups, excluirBackup } from '@/lib/backups/backups';
import { registrarAuditoria } from '@/utils/audit';

// GET /api/admin/backups — Lista backups
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ backups: await listarBackups() });
  } catch (err) {
    console.error('[backups] GET:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/admin/backups — Cria um backup do conteúdo do site
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const nome = body?.nome || '';
    const criado = await criarBackup(nome, admin.email || admin.id);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'backup',
      resumo: 'Backup criado',
      detalhe: 'Uma cópia de segurança do conteúdo do site foi criada manualmente.',
    }, req);

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error('[backups] POST:', err);
    return NextResponse.json({ error: 'Erro ao criar backup' }, { status: 500 });
  }
}

// DELETE /api/admin/backups — Exclui um backup
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    const resultado = await excluirBackup(id);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'backup',
      resumo: 'Backup excluído',
      detalhe: 'Uma cópia de segurança do site foi excluída manualmente.',
    }, req);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error('[backups] DELETE:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' }, { status: 400 });
  }
}