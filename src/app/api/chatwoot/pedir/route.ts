import { NextResponse } from 'next/server';
import { getConfiguracao } from '@/app/actions/cms';
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN } from '@/utils/chatwoot-config';

/**
 * Cria uma conversa no Chatwoot (mesmo fluxo do widget) e envia a mensagem
 * do cliente. Se `mensagem` for informado (ex: solicitação de agendamento),
 * usa esse texto; caso contrário usa o padrão de produto sem estoque.
 * Retorna o authToken (JWT) para o navegador gravar o cookie
 * cw_conversation e reabrir o widget na conversa.
 */
export async function POST(req: Request) {
  try {
    const { nome, descricao, mensagem } = await req.json();
    if (!nome) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    const [urlCfg, tokenCfg] = await Promise.all([
      getConfiguracao('chatwoot.url'),
      getConfiguracao('chatwoot.token'),
    ]);
    const baseUrl = ((urlCfg?.valor as string) || CHATWOOT_BASE_URL).replace(/\/$/, '');
    const websiteToken = (tokenCfg?.valor as string) || process.env.CHATWOOT_API_TOKEN || CHATWOOT_WEBSITE_TOKEN;
    if (!websiteToken) {
      console.error('[chatwoot/pedir] token do chatwoot não configurado');
      return NextResponse.json({ error: 'Chat não configurado' }, { status: 500 });
    }

    const mensagemPadrao = `Gostaria de comprar o produto ${nome}${descricao ? ` (${descricao})` : ''} mas não tem estoque, vocês conseguem pra mim?`;
    const textoMensagem = mensagem || mensagemPadrao;

    // 1. Carrega o HTML do widget e extrai o token de sessão (cria o contato)
    const widgetRes = await fetch(`${baseUrl}/widget?website_token=${websiteToken}`, {
      headers: { 'Accept': 'text/html' },
    });
    if (!widgetRes.ok) {
      console.error('[chatwoot/pedir] falha ao carregar widget:', widgetRes.status);
      return NextResponse.json({ error: 'Falha ao conectar ao chat' }, { status: 502 });
    }
    const widgetHtml = await widgetRes.text();
    const authMatch = widgetHtml.match(/window\.authToken\s*=\s*'([^']+)'/);
    if (!authMatch?.[1]) {
      console.error('[chatwoot/pedir] token não encontrado no HTML do widget');
      return NextResponse.json({ error: 'Token do chat não obtido' }, { status: 502 });
    }
    const authToken = authMatch[1];

    // 2. Cria a conversa e envia a mensagem (mesmo fluxo do widget)
    const convRes = await fetch(`${baseUrl}/api/v1/widget/conversations?website_token=${websiteToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
      body: JSON.stringify({
        contact: { name: 'Visitante' },
        message: { content: textoMensagem, timestamp: new Date().toString(), referer_url: '' },
      }),
    });
    if (!convRes.ok) {
      console.error('[chatwoot/pedir] falha ao criar conversa:', convRes.status);
      return NextResponse.json({ error: 'Falha ao criar conversa no chat' }, { status: 502 });
    }
    const convData = await convRes.json();

    return NextResponse.json({
      authToken,
      conversationId: convData?.id || convData?.conversation_id || null,
    });
  } catch (err) {
    console.error('[chatwoot/pedir] erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
