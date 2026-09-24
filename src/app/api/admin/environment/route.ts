import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { encryptEnvironmentPayload } from '@/utils/environment-crypto';
import { ENVIRONMENT_MANIFEST, validateEnvironmentPatch } from '@/utils/environment-manifest';
import { registrarAuditoria } from '@/utils/audit';

function hashConfirmationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicDiff(patch: Record<string, string>) {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => {
    const definition = ENVIRONMENT_MANIFEST.find((item) => item.key === key);
    return [key, {
      sensitive: definition?.sensitive ?? true,
      value: definition?.sensitive ? undefined : value,
      impact: definition?.impact || 'stack_redeploy',
      scope: definition?.scope || 'unknown',
    }];
  }));
}

// GET /api/admin/environment — catálogo sem valores e estado redigido
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const [keyResult, revisionResult] = await Promise.all([
      query(`SELECT key_id, created_at FROM public.environment_controller_keys WHERE active = true LIMIT 1`),
      query(`SELECT id, manifest_version, metadata, health_status, created_at
             FROM public.environment_revisions
             WHERE environment_name = 'production'
             ORDER BY created_at DESC LIMIT 1`),
    ]);
    const revision = revisionResult.rows[0] || null;
    const metadata = revision?.metadata || {};
    const entries = ENVIRONMENT_MANIFEST.map((definition) => ({
      ...definition,
      configured: metadata[definition.key]?.configured ?? null,
      source: metadata[definition.key]?.source ?? 'unknown',
      drift: metadata[definition.key]?.drift ?? null,
    }));

    return NextResponse.json({
      controllerAvailable: keyResult.rows.length > 0,
      revision: revision ? {
        id: revision.id,
        manifestVersion: revision.manifest_version,
        healthStatus: revision.health_status,
        createdAt: revision.created_at,
      } : null,
      variables: entries,
    });
  } catch (err) {
    console.error('[Environment] status error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/admin/environment/preview — cria solicitação criptografada, sem aplicar
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const patch = body?.patch;
    const validation = validateEnvironmentPatch(patch);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Patch inválido', details: validation.errors }, { status: 400 });
    }

    const [keyResult, revisionResult] = await Promise.all([
      query(`SELECT public_key FROM public.environment_controller_keys WHERE active = true LIMIT 1`),
      query(`SELECT id FROM public.environment_revisions WHERE environment_name = 'production' ORDER BY created_at DESC LIMIT 1`),
    ]);
    if (keyResult.rows.length === 0) {
      return NextResponse.json({ error: 'Controlador operacional indisponível' }, { status: 503 });
    }

    const expectedRevision = body?.expectedRevision || revisionResult.rows[0]?.id || 'initial';
    const encrypted = encryptEnvironmentPayload(patch as Record<string, string>, keyResult.rows[0].public_key);
    const confirmationToken = randomBytes(32).toString('hex');
    const diff = publicDiff(patch as Record<string, string>);

    const result = await query(
      `INSERT INTO public.environment_change_requests
         (actor_id, actor_email, expected_revision, status, impact, encrypted_payload,
          encrypted_key, payload_iv, payload_tag, public_diff_metadata, confirmation_token_hash)
       VALUES ($1,$2,$3,'awaiting_confirmation',$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, status, impact, expected_revision, public_diff_metadata, created_at`,
      [
        admin.id,
        admin.email,
        expectedRevision,
        validation.impact,
        encrypted.encryptedPayload,
        encrypted.encryptedKey,
        encrypted.iv,
        encrypted.tag,
        JSON.stringify({ keys: diff, reason: String(body?.reason || '').slice(0, 500) }),
        hashConfirmationToken(confirmationToken),
      ]
    );
    const request = result.rows[0];
    await query(
      `INSERT INTO public.environment_audit_log
         (request_id, actor_id, actor_email, action, key_names, redacted_metadata, result)
       VALUES ($1,$2,$3,'preview',$4,$5,'awaiting_confirmation')`,
      [request.id, admin.id, admin.email, validation.keys, JSON.stringify({ impact: validation.impact })]
    );

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'ambiente',
      resumo: 'Alteração de ambiente solicitada',
      detalhe: 'Foi solicitada uma alteração em variáveis internas de funcionamento do site (sem expor quais variáveis). A aplicação só ocorre após confirmação.',
    }, req);

    return NextResponse.json({
      requestId: request.id,
      confirmationToken,
      status: request.status,
      impact: request.impact,
      expectedRevision: request.expected_revision,
      diff: request.public_diff_metadata,
    }, { status: 201 });
  } catch (err) {
    console.error('[Environment] preview error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
