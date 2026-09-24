import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria } from '@/utils/audit';
import {
  PAGINAS_DISPONIVEIS,
  TIPOS_GOOGLE_TAG,
  TIPO_LABEL,
  validarTagInput,
  type GoogleTag,
} from '@/lib/google-tags';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_TAG = `SELECT id, nome, tipo, identificador, codigo, paginas, ativo, ordem, criado_em, atualizado_em
                      FROM public.google_tags`;

function nomeAdmin(admin: { email?: string; id: string }): string {
  return admin.email || admin.id;
}

function resumoPaginas(tag: Pick<GoogleTag, 'paginas'>): string {
  if (tag.paginas?.includes('todas')) return 'todas as páginas';
  const labels = (tag.paginas || []).map(
    slug => PAGINAS_DISPONIVEIS.find(p => p.slug === slug)?.label || slug
  );
  return labels.join(', ');
}

// GET /api/admin/trafego-pago/google-tags — Lista as tags + páginas disponíveis
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { rows } = await query(`${SELECT_TAG} ORDER BY ordem ASC, criado_em ASC`);
    return NextResponse.json(
      {
        tags: rows,
        paginas: PAGINAS_DISPONIVEIS,
        tipos: TIPOS_GOOGLE_TAG.map(tipo => ({ valor: tipo, label: TIPO_LABEL[tipo] })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Erro ao listar Google TAGS:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/admin/trafego-pago/google-tags — Cria uma tag
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const validacao = validarTagInput(body);
    if (!validacao.ok) {
      return NextResponse.json({ error: validacao.erros.join(' ') }, { status: 400 });
    }

    const t = validacao.valor;
    const { rows } = await query(
      `INSERT INTO public.google_tags (nome, tipo, identificador, codigo, paginas, ativo, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [t.nome, t.tipo, t.identificador, t.codigo, t.paginas, t.ativo, t.ordem]
    );
    const criada = rows[0] as GoogleTag;

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: nomeAdmin(admin),
      acao: 'trafego_pago',
      resumo: 'Tag do Google criada',
      detalhe: `A tag "${criada.nome}" (${TIPO_LABEL[criada.tipo]}) foi criada para ${resumoPaginas(criada)}.`,
    }, req);

    return NextResponse.json(criada, { status: 201 });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe uma tag com este identificador.' },
        { status: 409 }
      );
    }
    console.error('Erro ao criar Google TAG:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/admin/trafego-pago/google-tags — Atualiza uma tag (inclusive ativar/desativar)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { id, ...campos } = body as Record<string, unknown> & { id?: string };

    if (!id || !UUID_RE.test(String(id))) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const atual = await query(`SELECT * FROM public.google_tags WHERE id = $1`, [id]);
    if (atual.rows.length === 0) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    // Merge com o registro atual: valida sempre o objeto completo
    // (ex.: trocar o tipo exige identificador no novo formato).
    const mesclado = { ...atual.rows[0], ...campos };
    const validacao = validarTagInput(mesclado);
    if (!validacao.ok) {
      return NextResponse.json({ error: validacao.erros.join(' ') }, { status: 400 });
    }

    const t = validacao.valor;
    const { rows } = await query(
      `UPDATE public.google_tags
          SET nome = $2, tipo = $3, identificador = $4, codigo = $5,
              paginas = $6, ativo = $7, ordem = $8, atualizado_em = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, t.nome, t.tipo, t.identificador, t.codigo, t.paginas, t.ativo, t.ordem]
    );
    const atualizada = rows[0] as GoogleTag;

    const mudouStatus = typeof campos.ativo === 'boolean';
    const acaoStatus = atualizada.ativo ? 'ativada' : 'desativada';
    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: nomeAdmin(admin),
      acao: 'trafego_pago',
      resumo: mudouStatus
        ? `Tag do Google ${acaoStatus}`
        : 'Tag do Google atualizada',
      detalhe: `A tag "${atualizada.nome}" (${TIPO_LABEL[atualizada.tipo] || atualizada.tipo}) foi ${mudouStatus ? acaoStatus : 'atualizada'} — ${resumoPaginas(atualizada)}.`,
    }, req);

    return NextResponse.json(atualizada);
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe uma tag com este identificador.' },
        { status: 409 }
      );
    }
    console.error('Erro ao atualizar Google TAG:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/admin/trafego-pago/google-tags — Exclui uma tag
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id;

    if (!id || !UUID_RE.test(String(id))) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { rows } = await query(
      `DELETE FROM public.google_tags WHERE id = $1 RETURNING nome, tipo`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: nomeAdmin(admin),
      acao: 'trafego_pago',
      resumo: 'Tag do Google excluída',
      detalhe: `A tag "${rows[0].nome}" (${TIPO_LABEL[rows[0].tipo as GoogleTag['tipo']] || rows[0].tipo}) foi removida do site.`,
    }, req);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir Google TAG:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
