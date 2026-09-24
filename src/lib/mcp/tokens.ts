import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { query } from '@/utils/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function gerarToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function chaveCriptografia(): Buffer | null {
  const base = process.env.MCP_ADMIN_TOKEN || process.env.CRON_SECRET || '';
  if (!base) return null;
  return createHash('sha256').update(`${base}:mcp-token-enc`).digest();
}

export function criptografarToken(token: string): string {
  const key = chaveCriptografia();
  if (!key) throw new Error('Chave de criptografia de tokens não configurada');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('.');
}

export function descriptografarToken(payload: string): string {
  const key = chaveCriptografia();
  if (!key) throw new Error('Chave de criptografia de tokens não configurada');
  const [ivHex, tagHex, dataHex] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export function expiracaoPorDuracao(duracao: string): Date | null {
  const dias: Record<string, number> = { '1m': 30, '3m': 90, '12m': 365 };
  if (duracao === 'never') return null;
  const d = dias[duracao];
  if (!d) throw new Error('Duração inválida — use 1m, 3m, 12m ou never');
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

export interface TokenCriado {
  id: string;
  nome: string;
  token: string;
  created_at: Date;
  expires_at: Date | null;
  escopo: 'admin' | 'vendas';
}

export async function criarToken(nome: string, duracao: string, criadoPor: string, escopo: 'admin' | 'vendas' = 'admin'): Promise<TokenCriado> {
  if (!nome.trim()) throw new Error('Descrição é obrigatória');
  const token = gerarToken();
  const expiresAt = expiracaoPorDuracao(duracao);
  const { rows } = await query(
    `INSERT INTO public.mcp_tokens (nome, token_hash, token_enc, ultimos4, expires_at, created_at, escopo)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING id, nome, created_at, expires_at, escopo`,
    [nome.trim(), hashToken(token), criptografarToken(token), token.slice(-4), expiresAt, escopo]
  );
  await query(
    `INSERT INTO public.mcp_audit (acao, detalhes, criado_por)
     VALUES ('token_criado', $1, $2)`,
    [JSON.stringify({ id: rows[0].id, nome: nome.trim(), escopo }), criadoPor]
  ).catch(() => { /* auditoria é best-effort */ });
  return { id: rows[0].id, nome: nome.trim(), token, created_at: rows[0].created_at, expires_at: rows[0].expires_at, escopo: rows[0].escopo };
}

export async function listarTokens() {
  const { rows } = await query(
    `SELECT id, nome, created_at, expires_at, blocked, last_used_at, ultimos4, escopo
     FROM public.mcp_tokens ORDER BY created_at DESC`
  );
  return rows;
}

export async function alterarBloqueio(id: string, blocked: boolean) {
  if (!UUID_RE.test(id)) throw new Error('id deve ser um UUID válido');
  const { rows } = await query(
    `UPDATE public.mcp_tokens SET blocked = $2 WHERE id = $1 RETURNING id, nome, blocked`,
    [id, blocked]
  );
  if (!rows.length) throw new Error('Token não encontrado');
  return rows[0];
}

export async function excluirToken(id: string) {
  if (!UUID_RE.test(id)) throw new Error('id deve ser um UUID válido');
  const { rowCount } = await query('DELETE FROM public.mcp_tokens WHERE id = $1', [id]);
  if (!rowCount) throw new Error('Token não encontrado');
  return { success: true };
}

export async function obterTokenTexto(id: string): Promise<string> {
  if (!UUID_RE.test(id)) throw new Error('id deve ser um UUID válido');
  const { rows } = await query(
    `SELECT token_enc FROM public.mcp_tokens WHERE id = $1 AND blocked = false
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [id]
  );
  if (!rows.length) throw new Error('Token não encontrado ou bloqueado/expirado');
  if (!rows[0].token_enc) throw new Error('Token não recuperável (emitido sem criptografia)');
  return descriptografarToken(rows[0].token_enc);
}