import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { gerarCodigoCupom } from '@/lib/cupons';

const CAMPOS = [
  'titulo', 'descricao', 'imagem_url', 'link_url', 'tipo', 'tipo_campanha',
  'categoria', 'prioridade', 'mensagem_prompt', 'canal_padrao', 'follow_up_horas',
  'desconto', 'data_inicio', 'data_fim',
  'cupom_codigo', 'cupom_escopo', 'cupom_marca', 'cupom_produtos',
];

function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS) {
    if (k in body) out[k] = body[k] ?? null;
  }
  return out;
}

/** Valida o cupom enviado: normaliza o código e checa unicidade entre campanhas. */
async function prepararCupom(body: Record<string, unknown>, ignorarCampanhaId?: string) {
  const desconto = body.desconto;
  const temDesconto = typeof desconto === 'string' && (desconto.trim() !== '');
  let codigo = typeof body.cupom_codigo === 'string' ? body.cupom_codigo.trim() : '';
  const escopo = ['todos', 'marca', 'produtos'].includes(String(body.cupom_escopo)) ? String(body.cupom_escopo) : 'todos';

  // Sem desconto → cupom não faz sentido; zera os campos.
  if (!temDesconto) {
    return { cupom_codigo: null, cupom_escopo: 'todos', cupom_marca: null, cupom_produtos: [], erro: null };
  }

  // Sem código: gera automaticamente a partir do título (máx 16, A-Z0-9).
  if (!codigo) {
    codigo = gerarCodigoCupom(String(body.titulo || ''));
  } else {
    codigo = codigo.toUpperCase();
  }

  // Unicidade case-insensitive entre campanhas (exceto a que está sendo editada).
  const params: unknown[] = [codigo];
  let excluir = '';
  if (ignorarCampanhaId) {
    params.push(ignorarCampanhaId);
    excluir = 'AND id != $2';
  }
  const { rows } = await query(
    `SELECT id FROM public.campanhas WHERE UPPER(cupom_codigo) = $1 ${excluir} LIMIT 1`,
    params
  );
  if (rows.length > 0) {
    return { erro: `Já existe uma campanha usando o cupom "${codigo}". Escolha outro código.` };
  }

  return {
    cupom_codigo: codigo,
    cupom_escopo: escopo,
    cupom_marca: escopo === 'marca' ? (typeof body.cupom_marca === 'string' ? body.cupom_marca.trim() : null) : null,
    cupom_produtos: escopo === 'produtos' && Array.isArray(body.cupom_produtos)
      ? body.cupom_produtos.filter((p): p is string => typeof p === 'string')
      : [],
    erro: null,
  };
}

// GET /api/cms/campanhas — Lista campanhas
// query: ?admin=1 (todas, com status derivado) | default: ativas (público)
export async function GET(req: NextRequest) {
  const admin = req.nextUrl.searchParams.get('admin') === '1';
  if (admin) {
    const sessao = await getAdminSession();
    if (!sessao) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const result = await query(
      `SELECT ${admin
        ? `c.*,
           (SELECT COUNT(*) FROM public.campanha_imagens i WHERE i.campanha_id = c.id AND i.status = 'aprovada') AS qtd_imagens,
           (SELECT COUNT(*) FROM public.campanha_leads l WHERE l.campanha_id = c.id) AS qtd_leads`
        : `c.id, c.titulo, c.descricao, c.desconto, c.canal_padrao, c.data_inicio, c.data_fim, c.ativo`}
       FROM public.campanhas c
       ${admin ? '' : `WHERE c.ativo = true
         AND (c.data_inicio IS NULL OR c.data_inicio <= NOW())
         AND (c.data_fim IS NULL OR c.data_fim >= NOW())`}
       ORDER BY c.prioridade ASC, c.created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar campanhas:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/campanhas — Criar campanha (admin)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body?.titulo) return NextResponse.json({ error: 'titulo é obrigatório' }, { status: 400 });

    const c = pick(body);
    const cupom = await prepararCupom(body);
    if (cupom.erro) return NextResponse.json({ error: cupom.erro }, { status: 400 });

    const result = await query(
      `INSERT INTO public.campanhas
         (titulo, descricao, imagem_url, link_url, tipo, tipo_campanha, categoria,
          prioridade, mensagem_prompt, canal_padrao, follow_up_horas, desconto,
          data_inicio, data_fim, ativo, criado_por,
          cupom_codigo, cupom_escopo, cupom_marca, cupom_produtos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        c.titulo, c.descricao, c.imagem_url, c.link_url, c.tipo || 'banner',
        c.tipo_campanha || 'global', c.categoria, c.prioridade ?? 0,
        c.mensagem_prompt, c.canal_padrao || 'whatsapp', c.follow_up_horas ?? 24,
        c.desconto, c.data_inicio, c.data_fim, body.ativo ?? true, admin.id,
        cupom.cupom_codigo, cupom.cupom_escopo, cupom.cupom_marca, cupom.cupom_produtos,
      ]
    );
    const campanha = result.rows[0];
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'criada',$2,$3)`,
      [campanha.id, JSON.stringify({ titulo: campanha.titulo }), admin.id]
    );
    return NextResponse.json(campanha, { status: 201 });
  } catch (err) {
    console.error('Erro ao criar campanha:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/cms/campanhas — Atualizar campanha (admin)
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const c = pick(body);
    // Cupom é processado à parte do pick (normalização + unicidade + escopo).
    const possuiCampoCupom = CAMPOS.some((k) => k.startsWith('cupom_') && k in body);
    const cupom = possuiCampoCupom ? await prepararCupom(body, id) : null;
    if (cupom?.erro) return NextResponse.json({ error: cupom.erro }, { status: 400 });

    const sets: string[] = [];
    const vals: unknown[] = [id];
    for (const k of CAMPOS) {
      // Campos de cupom são tratados por prepararCupom (normalização+único);
      // se o cupom foi processado, os valores vêm de `cupom`, não de body.
      if (cupom && k.startsWith('cupom_')) continue;
      if (k in body && body[k] !== undefined) {
        sets.push(`${k} = $${vals.length + 1}`);
        vals.push(body[k] ?? null);
      }
    }
    if (cupom) {
      for (const k of ['cupom_codigo', 'cupom_escopo', 'cupom_marca', 'cupom_produtos'] as const) {
        sets.push(`${k} = $${vals.length + 1}`);
        vals.push(cupom[k]);
      }
    }
    if ('ativo' in body) {
      sets.push(`ativo = $${vals.length + 1}`);
      vals.push(body.ativo);
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });

    const result = await query(
      `UPDATE public.campanhas SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'atualizada',$2,$3)`,
      [id, JSON.stringify(pick(body)), admin.id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar campanha:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/campanhas — Excluir campanha (admin)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    await query('DELETE FROM public.campanhas WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir campanha:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
