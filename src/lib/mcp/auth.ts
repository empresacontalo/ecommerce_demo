import { createHash } from 'crypto';
import { query } from '@/utils/db';

export type EscopoMCP = 'admin' | 'vendas';

export interface MCPAuth {
  ok: boolean;
  escopo: EscopoMCP;
  nome?: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Valida o token MCP apresentado (Authorization: Bearer <token>):
 * 1. Chave mestre de bootstrap (env MCP_ADMIN_TOKEN) — sempre escopo 'admin';
 * 2. Tokens emitidos na tabela public.mcp_tokens (hash sha256) — apenas
 *    não bloqueados, dentro da validade, com o escopo definido na criação:
 *    - 'admin'  → consulta + venda + alterar qualquer dado do site
 *    - 'vendas' → apenas consultas de informação e realização de vendas.
 */
export async function isMCPAuthorized(request: Request): Promise<MCPAuth> {
  const token = bearer(request);
  if (!token) return { ok: false, escopo: 'admin', nome: undefined };

  const master = process.env.MCP_ADMIN_TOKEN;
  if (master && token === master) return { ok: true, escopo: 'admin', nome: 'Token mestre' };

  const hash = sha256(token);
  try {
    const { rows } = await query(
      `SELECT id, nome, escopo FROM public.mcp_tokens
       WHERE token_hash = $1 AND blocked = false
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [hash]
    );
    if (rows.length > 0) {
      query('UPDATE public.mcp_tokens SET last_used_at = NOW() WHERE id = $1', [rows[0].id])
        .catch(() => { /* registro de uso é best-effort */ });
      const escopo: EscopoMCP = rows[0].escopo === 'vendas' ? 'vendas' : 'admin';
      return { ok: true, escopo, nome: rows[0].nome || 'Token MCP' };
    }
  } catch {
    return { ok: false, escopo: 'admin' };
  }
  return { ok: false, escopo: 'admin' };
}

/** Bloqueia ferramentas que alteram dados quando o token é somente de vendas. */
export function exigirEscopoAdmin(escopo: EscopoMCP, ferramenta: string): void {
  if (escopo !== 'admin') {
    throw new Error(
      `Permissão insuficiente: o token MCP é do tipo "vendas" (consulta e venda) e não pode executar "${ferramenta}". Use um token "admin" para alterar dados do site.`
    );
  }
}

export { sha256 };