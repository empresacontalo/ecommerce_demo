import { getConfiguracao } from '@/app/actions/cms';
import { normalizarWhatsApp } from '@/utils/campanhas';

/**
 * Solicita ao agente de atendimento (fazer.ai agents via Chatwoot) que
 * informe o cliente os dados de envio do pedido.
 *
 * Como funciona: o site cria uma conversa no Chatwoot com o contato do
 * cliente (nome, e-mail e telefone/WhatsApp) e uma mensagem inicial do
 * cliente pedindo acompanhamento. O agente vinculado à caixa de entrada
 * assume a conversa e envia a resposta (mensagem proativa) com os dados
 * de rastreio/acompanhamento — que ele consulta pelo MCP do site.
 *
 * Se a caixa de entrada WhatsApp do agente estiver conectada, a resposta
 * chega ao WhatsApp do cliente; caso contrário, cai na caixa web.
 *
 * O token/configuração vem do CMS (Admin > Configurações > Solicitações
 * aos Agentes): agente.mcp_url, agente.nome, agente.mcp_token, além de
 * chatwoot.url e chatwoot.token (caixa usada para criar a conversa).
 */

interface DadosPedidoParaAgente {
  pedidoId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone?: string | null;
}

interface ResultadoSolicitacao {
  ok: boolean;
  conversa?: { id?: number | string | null; chatwootUserId?: string | null };
  canal?: string;
  motivo?: string;
}

/** Extrai o token de sessão do HTML do widget (identifica o contato). */
async function obterAuthTokenWidget(baseUrl: string, websiteToken: string): Promise<string | null> {
  const widgetRes = await fetch(`${baseUrl}/widget?website_token=${encodeURIComponent(websiteToken)}`, {
    headers: { Accept: 'text/html' },
  });
  if (!widgetRes.ok) return null;
  const html = await widgetRes.text();
  const m = html.match(/window\.authToken\s*=\s*'([^']+)'/);
  return m?.[1] ?? null;
}

/**
 * Cria a conversa no Chatwoot com o contato completo do cliente e a
 * mensagem inicial pedindo acompanhamento. O agente vinculado à caixa
 * responde proativamente com os dados de envio.
 */
export async function solicitarAgenteInformarEnvio(dados: DadosPedidoParaAgente): Promise<ResultadoSolicitacao> {
  try {
    const [urlCfg, tokenCfg, agenteUrlCfg, agenteTokenCfg] = await Promise.all([
      getConfiguracao('chatwoot.url'),
      getConfiguracao('chatwoot.token'),
      getConfiguracao('agente.mcp_url'),
      getConfiguracao('agente.mcp_token'),
    ]);

    const baseUrl = ((urlCfg?.valor as string) || 'https://chat.digitalarea.online').replace(/\/+$/, '');
    const websiteToken = (tokenCfg?.valor as string) || '';
    if (!websiteToken) return { ok: false, motivo: 'chatwoot.token não configurado' };

    const agenteConfigurado = Boolean(agenteUrlCfg?.valor && agenteTokenCfg?.valor);
    if (!agenteConfigurado) {
      return { ok: false, motivo: 'agente não configurado (Admin > Configurações > Solicitações aos Agentes)' };
    }

    const authToken = await obterAuthTokenWidget(baseUrl, websiteToken);
    if (!authToken) return { ok: false, motivo: 'token do widget não obtido' };

    const idCurto = dados.pedidoId.slice(0, 8).toUpperCase();
    const mensagemInicial = `Olá! Meu pedido #${idCurto} foi enviado e gostaria de acompanhar a entrega. 😊`;

    const contact: Record<string, unknown> = { name: dados.clienteNome || 'Cliente' };
    if (dados.clienteEmail?.trim()) contact.email = dados.clienteEmail.trim();
    // Número com DDI 55 (ex: 11967608591 → 5511967608591) para o WhatsApp
    // reconhecer o contato quando a caixa do WhatsApp estiver conectada.
    const tel = normalizarWhatsApp(dados.clienteTelefone);
    if (tel) contact.phone_number = `+${tel}`;

    const convRes = await fetch(`${baseUrl}/api/v1/widget/conversations?website_token=${encodeURIComponent(websiteToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
      body: JSON.stringify({
        contact,
        message: { content: mensagemInicial, timestamp: new Date().toString(), referer_url: '' },
      }),
    });
    if (!convRes.ok) {
      return { ok: false, motivo: `conversa não criada (HTTP ${convRes.status})` };
    }
    const convData = await convRes.json();

    const conversaId = convData?.id ?? convData?.conversation_id ?? null;
    const contatoId = convData?.contact_id ?? convData?.contact?.id ?? null;

    return {
      ok: true,
      conversa: { id: conversaId, chatwootUserId: contatoId != null ? String(contatoId) : null },
      canal: dados.clienteTelefone?.trim() ? 'whatsapp' : 'web',
    };
  } catch (err) {
    console.error('[solicitar-agente] erro:', err);
    return { ok: false, motivo: 'falha ao solicitar agente' };
  }
}