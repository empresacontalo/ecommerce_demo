import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { criarToken, listarTokens, alterarBloqueio, excluirToken } from '@/lib/mcp/tokens';
import { query } from '@/utils/db';
import { registrarAuditoria } from '@/utils/audit';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ tokens: await listarTokens() });
  } catch (err) {
    console.error('[mcp-tokens] GET:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// POST /api/admin/mcp-tokens — Emite um token (retorna o texto UMA única vez)
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { nome, duracao, escopo } = await req.json();
    if (!nome || typeof nome !== 'string') {
      return NextResponse.json({ error: 'descricao é obrigatória' }, { status: 400 });
    }
    const escopoValido = escopo === 'vendas' ? 'vendas' : 'admin';
    const criado = await criarToken(nome, duracao || 'never', admin.email || admin.id, escopoValido);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'token_mcp',
      resumo: 'Token de acesso à IA criado',
      detalhe: `Um novo token de acesso para a inteligência artificial ("${nome}", com permissão de ${escopoValido === 'vendas' ? 'consulta e vendas' : 'administração completa'}) foi emitido.`,
    }, req);

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error('[mcp-tokens] POST:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' }, { status: 400 });
  }
}

// PUT /api/admin/mcp-tokens — Bloquear/desbloquear
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { id, blocked } = await req.json();
    if (!id || typeof blocked !== 'boolean') {
      return NextResponse.json({ error: 'id e blocked são obrigatórios' }, { status: 400 });
    }
    const token = await alterarBloqueio(id, blocked);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'token_mcp',
      resumo: blocked ? 'Token de acesso à IA bloqueado' : 'Token de acesso à IA reativado',
      detalhe: blocked
        ? `O token de acesso da IA ${token.nome ? `"${token.nome}" ` : ''}foi bloqueado e não pode mais alterar o site.`
        : `O token de acesso da IA ${token.nome ? `"${token.nome}" ` : ''}foi reativado.`,
    }, req);

    return NextResponse.json(token);
  } catch (err) {
    console.error('[mcp-tokens] PUT:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' }, { status: 400 });
  }
}

// DELETE /api/admin/mcp-tokens — Excluir token
export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const antes = await query('SELECT nome FROM public.mcp_tokens WHERE id = $1', [id]);
    const resultado = await excluirToken(id);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'token_mcp',
      resumo: 'Token de acesso à IA excluído',
      detalhe: `O token de acesso da IA ${antes.rows[0]?.nome ? `"${antes.rows[0].nome}" ` : ''}foi excluído permanentemente.`,
    }, req);

    return NextResponse.json(resultado);
  } catch (err) {
    console.error('[mcp-tokens] DELETE:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' }, { status: 400 });
  }
}