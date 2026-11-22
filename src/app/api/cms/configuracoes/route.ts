import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria, rotuloConfiguracao } from '@/utils/audit';

// GET /api/cms/configuracoes?chave=header.logo — Busca uma config
// Público: retorna apenas chaves não sensíveis. Admin: retorna tudo.
const CHAVES_SENSIVEIS = ['pagamento.', 'chatwoot.', 'agente.']; // agente. → token MCP do agente de atendimento

function chaveSensivel(chave: string): boolean {
  return CHAVES_SENSIVEIS.some((prefixo) => chave.startsWith(prefixo));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chave = searchParams.get('chave');
    const admin = await getAdminSession();
    const canViewSensitive = !!admin && !admin.readOnly;

    if (chave) {
      if (!canViewSensitive && chaveSensivel(chave)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const result = await query(
        'SELECT * FROM public.configuracoes WHERE chave = $1',
        [chave]
      );
      if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(result.rows[0]);
    }

    const result = await query('SELECT * FROM public.configuracoes ORDER BY chave ASC');
    const rows = canViewSensitive ? result.rows : result.rows.filter((r) => !chaveSensivel(r.chave));
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Erro ao buscar configs:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/cms/configuracoes — Criar/Atualizar configuração (admin) - UPSERT
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { chave, valor, descricao } = await req.json();
    if (!chave || valor === undefined) return NextResponse.json({ error: 'chave e valor são obrigatórios' }, { status: 400 });

    const result = await query(
      `INSERT INTO public.configuracoes (chave, valor, descricao)
       VALUES ($1, $2, $3)
       ON CONFLICT (chave) DO UPDATE SET valor = $2, descricao = COALESCE($3, public.configuracoes.descricao)
       RETURNING *`,
      [chave, JSON.stringify(valor), descricao || null]
    );

    const rotulo = rotuloConfiguracao(chave);
    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'configuracao',
      resumo: `Configuração alterada: ${rotulo}`,
      detalhe: `O valor de "${rotulo}" foi salvo. As alterações já estão ativas no site.`,
    }, req);

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar config:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// DELETE /api/cms/configuracoes — Excluir configuração (admin)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    await query('DELETE FROM public.configuracoes WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir config:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
