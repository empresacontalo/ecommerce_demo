import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '@/lib/mcp/tools';
import type { EscopoMCP } from '@/lib/mcp/auth';

/**
 * Cria uma instância do servidor MCP com todas as ferramentas do painel
 * administrativo registradas. Chamado por request (stateless) na rota /api/mcp.
 *
 * O escopo do token define o que a IA pode fazer:
 * - 'admin'  → consulta + venda + alterar qualquer dado do site;
 * - 'vendas' → apenas consultas de informação e realização de vendas
 *              (ferramentas de alteração de conteúdo são bloqueadas).
 */
export function createMcpServer(
  escopo: EscopoMCP = 'admin',
  req?: Request | null,
  nomeToken?: string,
): McpServer {
  const server = new McpServer({
    name: 'portal-gerenciavel-admin',
    version: '1.0.0',
    description:
      'Servidor MCP do painel administrativo do Portal Gerenciável. ' +
      'Permite ler e alterar o conteúdo do site (páginas, blocos, configurações, depoimentos, ' +
      'galeria, campanhas, produtos, leads, agendamentos, pedidos, usuários admin e status do ambiente) ' +
      'e realizar vendas completas (checkout + cobrança). ' +
      'Tokens com escopo "vendas" só consultam e vendem; tokens "admin" alteram todos os dados. ' +
      'Valores sensíveis (segredos de ambiente) nunca são retornados. Confirme sempre com o usuário ' +
      'antes de alterar dados de produção.',
  });
  registerTools(server, escopo, req, nomeToken);
  return server;
}