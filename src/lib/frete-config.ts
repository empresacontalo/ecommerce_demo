import { query } from '@/utils/db';
import { parseTabelaMotoboy, TabelaMotoboy } from '@/utils/frete';

export const CHAVE_FRETE_MOTOBOY = 'frete.motoboy';

/**
 * Lê a configuração `frete.motoboy` do CMS (municípios + taxa em R$).
 * Retorna a tabela normalizada, ou null se não configurada/inválida
 * (aí os callers usam a tabela padrão do código).
 */
export async function getFreteMotoboyConfig(): Promise<TabelaMotoboy | null> {
  try {
    const { rows } = await query(
      'SELECT valor FROM public.configuracoes WHERE chave = $1',
      [CHAVE_FRETE_MOTOBOY]
    );
    return parseTabelaMotoboy(rows[0]?.valor);
  } catch (err) {
    console.error('Erro ao ler config frete.motoboy:', err);
    return null;
  }
}