import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria } from '@/utils/audit';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// POST /api/admin/environment/apply — confirma e enfileira; não executa Portainer no app
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { requestId, confirmationToken, expectedRevision, reason, confirmed } = await req.json();
    if (!requestId || !confirmationToken || !confirmed) {
      return NextResponse.json({ error: 'Confirmação explícita obrigatória' }, { status: 400 });
    }

    const result = await query(
      `UPDATE public.environment_change_requests
       SET status = 'queued', confirmation_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND actor_id = $2 AND status = 'awaiting_confirmation'
         AND expected_revision = $3 AND confirmation_token_hash = $4
       RETURNING id, status, impact, expected_revision, public_diff_metadata, created_at`,
      [requestId, admin.id, expectedRevision, hashToken(confirmationToken)]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Solicitação inválida, expirada ou desatualizada' }, { status: 409 });
    }

    await query(
      `INSERT INTO public.environment_audit_log
         (request_id, actor_id, actor_email, action, key_names, redacted_metadata, result)
       SELECT id, $2, $3, 'apply_requested',
              ARRAY(SELECT jsonb_object_keys(public_diff_metadata->'keys')),
              jsonb_build_object('impact', impact, 'reason', LEFT($4, 500)), 'queued'
       FROM public.environment_change_requests WHERE id = $1`,
      [requestId, admin.id, admin.email, String(reason || '')]
    );

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'ambiente',
      resumo: 'Alteração de ambiente aplicada',
      detalhe: 'Uma alteração em variáveis internas de funcionamento do site foi confirmada e enviada para aplicação (sem expor quais variáveis).',
    }, req);

    return NextResponse.json({ operationId: requestId, status: 'queued', impact: result.rows[0].impact });
  } catch (err) {
    console.error('[Environment] apply request error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
