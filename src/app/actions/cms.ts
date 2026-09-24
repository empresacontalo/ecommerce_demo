'use server';

import { query } from '@/utils/db';

export interface CmsBloco {
  id: string; pagina_id: string; tipo: string;
  titulo: string | null; ordem: number; conteudo: any; ativo: boolean;
}

export async function getBlocosPorSlug(slug: string): Promise<CmsBloco[]> {
  const p = await query('SELECT id FROM public.paginas WHERE slug=$1 AND ativo=true', [slug]);
  if (p.rows.length === 0) return [];
  const r = await query('SELECT * FROM public.blocos WHERE pagina_id=$1 AND ativo=true ORDER BY ordem ASC', [p.rows[0].id]);
  return r.rows;
}

export async function getPaginas() {
  return (await query('SELECT * FROM public.paginas WHERE ativo=true ORDER BY titulo ASC')).rows;
}

/** Todas as páginas (admin, inclui inativas) */
export async function getTodasPaginas() {
  return (await query('SELECT * FROM public.paginas ORDER BY titulo ASC')).rows;
}

/** Verifica se a página está ativa. Páginas sem registro (hardcoded) são sempre ativas. */
export async function isPaginaAtiva(slug: string): Promise<boolean> {
  try {
    const r = await query('SELECT ativo FROM public.paginas WHERE slug=$1', [slug]);
    if (r.rows.length === 0) return true;
    return r.rows[0].ativo === true;
  } catch {
    return true;
  }
}

export async function getConfiguracao(chave: string) {
  try {
    const r = await query('SELECT * FROM public.configuracoes WHERE chave=$1', [chave]);
    return r.rows[0] || null;
  } catch {
    return null;
  }
}

export async function getDepoimentos() {
  return (await query('SELECT * FROM public.depoimentos WHERE ativo=true ORDER BY ordem ASC')).rows;
}

export async function getGaleriaItens(categoria?: string) {
  let s = 'SELECT * FROM public.galeria WHERE ativo=true';
  const p: string[] = [];
  if (categoria) { s += ' AND categoria=$1'; p.push(categoria); }
  s += ' ORDER BY ordem ASC';
  return (await query(s, p)).rows;
}

export async function getCampanhas() {
  return (await query(`SELECT * FROM public.campanhas WHERE ativo=true AND (data_inicio IS NULL OR data_inicio<=NOW()) AND (data_fim IS NULL OR data_fim>=NOW()) ORDER BY created_at DESC`)).rows;
}
