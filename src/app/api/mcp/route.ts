import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { isMCPAuthorized } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint MCP (Model Context Protocol) do Portal Gerenciável.
 * Permite que uma inteligência artificial (Claude, Cursor, etc.) conectada
 * pelo cliente execute as mesmas operações do painel administrativo.
 *
 * Conexão (cliente MCP): URL https://portalgerenciavel.digitalarea.online/api/mcp
 * Autenticação: header Authorization: Bearer <MCP_ADMIN_TOKEN>
 */
async function handle(req: Request): Promise<Response> {
  const auth = await isMCPAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Não autorizado — token MCP inválido' }, { status: 401 });
  }
  const server = createMcpServer(auth.escopo, req, auth.nome);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
    },
  });
}