import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { criarBackup, descompactarPayload, restaurarConteudo } from '@/lib/backups/backups';
import { registrarAuditoria } from '@/utils/audit';

const MAX_IMPORT = 50 * 1024 * 1024; // 50 MB (comprimido)

function ehUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/backups/import — Restaura conteúdo a partir de um backup
 * comprimido (gzip). Aceita:
 *  - multipart/form-data com campo "arquivo" (.backup.json.gz ou .json)
 *  - JSON {"url": "https://..."} com o link para o arquivo na VPS
 * Requer "confirmado": true. Cria automaticamente um backup do estado atual.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const contentType = req.headers.get('content-type') || '';
    let buffer: Buffer;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const confirmado = form.get('confirmado') === 'true';
      if (!confirmado) return NextResponse.json({ error: 'Confirmação obrigatória' }, { status: 400 });
      const arquivo = form.get('arquivo');
      if (!(arquivo instanceof File) || !arquivo.size) {
        return NextResponse.json({ error: 'arquivo é obrigatório' }, { status: 400 });
      }
      if (arquivo.size > MAX_IMPORT) return NextResponse.json({ error: 'Arquivo muito grande (máx. 50 MB)' }, { status: 400 });
      buffer = Buffer.from(await arquivo.arrayBuffer());
    } else {
      const body = await req.json();
      if (body?.confirmado !== true) return NextResponse.json({ error: 'Confirmação obrigatória' }, { status: 400 });
      const url = body?.url;
      if (!ehUrl(url)) {
        return NextResponse.json({ error: 'Informe um link http(s) válido com a localização do arquivo' }, { status: 400 });
      }
      const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
      if (!resp.ok) return NextResponse.json({ error: `Falha ao baixar o arquivo (HTTP ${resp.status})` }, { status: 502 });
      const bytes = Buffer.from(await resp.arrayBuffer());
      if (bytes.length > MAX_IMPORT) return NextResponse.json({ error: 'Arquivo muito grande (máx. 50 MB)' }, { status: 400 });
      buffer = bytes;
    }

    // Descompacta e valida
    const payload = descompactarPayload(buffer);

    // Segurança: guarda o estado atual antes de restaurar
    const seguranca = await criarBackup('Antes da restauração (automático)', admin.email || admin.id);

    const resultado = await restaurarConteudo(payload);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'backup',
      resumo: 'Backup importado',
      detalhe: 'Um arquivo de cópia de segurança foi importado e aplicado ao site. O conteúdo anterior foi guardado automaticamente como cópia de segurança.',
    }, req);

    return NextResponse.json({
      success: true,
      restaurado: { tabelas: resultado.tabelas_restauradas.length, linhas: resultado.linhas },
      backup_seguranca_id: seguranca.id,
    });
  } catch (err) {
    console.error('[backups] IMPORT:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao importar backup' }, { status: 400 });
  }
}