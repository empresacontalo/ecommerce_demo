'use server';

import { query } from '@/utils/db';
import { paginaPodeReceberTags, tagAplicaNaPagina, type GoogleTag } from '@/lib/google-tags';

/**
 * Tags ativas cujo escopo cobre a navegação atual.
 * Nunca lança exceção: se a tabela ainda não existir (migration pendente)
 * ou o banco falhar, o site continua renderizando sem tags.
 */
export async function getGoogleTagsDaPagina(pathname: string): Promise<GoogleTag[]> {
  // admin/auth/api nunca recebem tag — evita consulta desnecessária.
  if (!paginaPodeReceberTags(pathname)) return [];

  try {
    const { rows } = await query(
      `SELECT id, nome, tipo, identificador, codigo, paginas, ativo, ordem
         FROM public.google_tags
        WHERE ativo = true
        ORDER BY ordem ASC, criado_em ASC`
    );
    return (rows as GoogleTag[]).filter(tag => tagAplicaNaPagina(tag.paginas, pathname));
  } catch (err) {
    console.error(
      '[google-tags] falha ao carregar tags da página:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
