import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { registrarAuditoria, rotuloConfiguracao } from '@/utils/audit';

// Configuração da conexão com o agente de atendimento (fazer.ai agents / Chatwoot).
// Chaves: agente.mcp_url | agente.mcp_token | agente.nome
// O TOKEN NUNCA é devolvido ao navegador — o GET informa apenas se há um
// configurado; para trocá-lo, o admin envia o novo valor (sobrescreve o atual).

async function carregar() {
  const { rows } = await query(
    `SELECT chave, valor FROM public.configuracoes
     WHERE chave IN ('agente.mcp_url', 'agente.mcp_token', 'agente.nome')`
  );
  const mapa: Record<string, unknown> = {};
  for (const r of rows) mapa[r.chave] = r.valor;
  return mapa;
}

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const mapa = await carregar();
    return NextResponse.json({
      mcpUrl: typeof mapa['agente.mcp_url'] === 'string' ? mapa['agente.mcp_url'] : '',
      agenteNome: typeof mapa['agente.nome'] === 'string' ? mapa['agente.nome'] : '',
      // Nunca expõe o token: só a flag "existe".
      tokenConfigurado: typeof mapa['agente.mcp_token'] === 'string' && (mapa['agente.mcp_token'] as string).length > 0,
    });
  } catch (err) {
    console.error('[admin/agente] erro ao carregar:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { mcpUrl, agenteNome, mcpToken } = await req.json();
    if (!mcpUrl || typeof mcpUrl !== 'string' || !mcpUrl.trim()) {
      return NextResponse.json({ error: 'URL do MCP é obrigatória' }, { status: 400 });
    }
    if (!agenteNome || typeof agenteNome !== 'string' || !agenteNome.trim()) {
      return NextResponse.json({ error: 'Nome do agente é obrigatório' }, { status: 400 });
    }

    const saves: Array<Promise<unknown>> = [
      query(
        `INSERT INTO public.configuracoes (chave, valor, descricao) VALUES ($1,$2,$3)
         ON CONFLICT (chave) DO UPDATE SET valor = $2, descricao = $3`,
        ['agente.mcp_url', `"${mcpUrl.trim().replace(/"/g, '')}"`, 'URL do servidor MCP do agente de atendimento']
      ),
      query(
        `INSERT INTO public.configuracoes (chave, valor, descricao) VALUES ($1,$2,$3)
         ON CONFLICT (chave) DO UPDATE SET valor = $2, descricao = $3`,
        ['agente.nome', `"${agenteNome.trim().replace(/"/g, '')}"`, 'Nome do agente de atendimento (fazer.ai agents)']
      ),
    ];

    // Só sobrescreve o token quando o admin DIGITOU um novo valor.
    let tokenConfigurado = false;
    if (typeof mcpToken === 'string' && mcpToken.trim().length > 0) {
      saves.push(query(
        `INSERT INTO public.configuracoes (chave, valor, descricao) VALUES ($1,$2,$3)
         ON CONFLICT (chave) DO UPDATE SET valor = $2, descricao = $3`,
        ['agente.mcp_token', `"${mcpToken.trim().replace(/"/g, '')}"`, 'Token MCP do agente de atendimento (secreto)']
      ));
      tokenConfigurado = true;
    } else {
      const mapa = await carregar();
      tokenConfigurado = typeof mapa['agente.mcp_token'] === 'string' && (mapa['agente.mcp_token'] as string).length > 0;
    }

    await Promise.all(saves);

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'configuracao',
      resumo: 'Conexão com o agente de atendimento atualizada',
      detalhe: tokenConfigurado
        ? 'URL, nome do agente e token configurados para solicitações ao agente.'
        : 'URL e nome do agente atualizados (token mantido).',
    }, req);

    return NextResponse.json({ success: true, tokenConfigurado });
  } catch (err) {
    console.error('[admin/agente] erro ao salvar:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}