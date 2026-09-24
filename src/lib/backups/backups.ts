import { gunzipSync, gzipSync } from 'zlib';
import { pool, query } from '@/utils/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tabelas que compõem o "conteúdo do site" (o que o painel administra).
 * Ordem de restauração: pais antes dos filhos (para FKs).
 * (A exclusão acontece na ordem inversa.)
 */
export const TABELAS_CONTEUDO: string[] = [
  'paginas',
  'blocos',
  'configuracoes',
  'depoimentos',
  'galeria',
  'campanhas',
  'campanha_imagens',
  'campanha_leads',
  'campanha_contatos',
  'campanha_decoracoes',
  'campanha_familiares',
  'campanha_historico',
  'produtos',
  'leads',
  'agendamentos',
  'orders',
];

export interface BackupPayload {
  versao: number;
  criado_em: string;
  tabelas: Record<string, unknown[]>;
}

/**
 * Compacta o payload com gzip em nível máximo de compressão.
 */
export function compactarPayload(payload: BackupPayload): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
}

/**
 * Descompacta um buffer de backup (gzip). Aceita também JSON puro.
 */
export function descompactarPayload(buffer: Buffer): BackupPayload {
  let texto: string;
  try {
    texto = gunzipSync(buffer).toString('utf8');
  } catch {
    texto = buffer.toString('utf8');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(texto);
  } catch {
    throw new Error('Arquivo de backup inválido — não é um JSON válido');
  }
  if (!payload || typeof payload !== 'object' || !(payload as BackupPayload).tabelas || typeof (payload as BackupPayload).tabelas !== 'object') {
    throw new Error('Arquivo de backup inválido — estrutura não reconhecida');
  }
  return payload as BackupPayload;
}

function soExistentes(tabelas: string[]): Promise<Set<string>> {
  return query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tabelas]
  ).then((r) => new Set(r.rows.map((x) => x.table_name)));
}

/** Captura um snapshot das tabelas de conteúdo. */
export async function snapshotConteudo(): Promise<BackupPayload> {
  const existentes = await soExistentes(TABELAS_CONTEUDO);
  const tabelas: Record<string, unknown[]> = {};
  for (const tabela of TABELAS_CONTEUDO) {
    if (!existentes.has(tabela)) continue;
    const { rows } = await query(`SELECT * FROM public."${tabela}"`);
    tabelas[tabela] = rows;
  }
  return { versao: 1, criado_em: new Date().toISOString(), tabelas };
}

/** Restaura o conteúdo em uma única transação (substitui o estado atual). */
export async function restaurarConteudo(payload: BackupPayload): Promise<{ tabelas_restauradas: string[]; linhas: number }> {
  if (!payload?.tabelas || typeof payload !== 'object') {
    throw new Error('Payload de backup inválido');
  }
  // Order fixa de TABELAS_CONTEUDO (jsonb não preserva a ordem das chaves;
  // Object.keys(payload.tabelas) chegava desordenado e quebrava FKs — paginas
  // podia vir depois de blocos).
  const tabelas = TABELAS_CONTEUDO.filter((t) => Array.isArray(payload.tabelas[t]) && (payload.tabelas[t] as unknown[]).length > 0);
  const existentes = await soExistentes(tabelas);
  const client = await pool.connect();
  let linhas = 0;
  try {
    await client.query('BEGIN');
    // 1) Exclui na ordem inversa (filhos antes dos pais)
    for (const tabela of [...tabelas].reverse()) {
      if (!existentes.has(tabela)) continue;
      await client.query(`DELETE FROM public."${tabela}"`);
    }
    // 2) Insere na ordem original (pais antes dos filhos)
    for (const tabela of tabelas) {
      if (!existentes.has(tabela)) continue;
      const linhasTabela = payload.tabelas[tabela] ?? [];
      if (!linhasTabela.length) continue;
      const { rowCount } = await client.query(
        `INSERT INTO public."${tabela}" SELECT * FROM jsonb_populate_recordset(NULL::public."${tabela}", $1::jsonb)`,
        [JSON.stringify(linhasTabela)]
      );
      linhas += Number(rowCount || 0);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { tabelas_restauradas: tabelas, linhas };
}

export interface BackupListaItem {
  id: string;
  nome: string;
  criado_por: string | null;
  tamanho_bytes: number;
  created_at: Date;
}

export async function criarBackup(nome: string, criadoPor: string | null): Promise<BackupListaItem> {
  const payload = await snapshotConteudo();
  const tamanho = JSON.stringify(payload).length;
  const { rows } = await query(
    `INSERT INTO public.backups (nome, criado_por, tamanho_bytes, payload)
     VALUES ($1, $2, $3, $4) RETURNING id, nome, criado_por, tamanho_bytes, created_at`,
    [nome.trim() || `Backup ${new Date().toLocaleString('pt-BR')}`, criadoPor, tamanho, payload]
  );
  return rows[0];
}

export async function listarBackups(): Promise<BackupListaItem[]> {
  const { rows } = await query(
    `SELECT id, nome, criado_por, tamanho_bytes, created_at FROM public.backups ORDER BY created_at DESC`
  );
  return rows;
}

export async function excluirBackup(id: string) {
  if (!UUID_RE.test(id)) throw new Error('id deve ser um UUID válido');
  const { rowCount } = await query('DELETE FROM public.backups WHERE id = $1', [id]);
  if (!rowCount) throw new Error('Backup não encontrado');
  return { success: true };
}

export async function obterBackup(id: string): Promise<{ id: string; nome: string; payload: BackupPayload }> {
  if (!UUID_RE.test(id)) throw new Error('id deve ser um UUID válido');
  const { rows } = await query('SELECT id, nome, payload FROM public.backups WHERE id = $1', [id]);
  if (!rows.length) throw new Error('Backup não encontrado');
  return { id: rows[0].id, nome: rows[0].nome, payload: rows[0].payload };
}