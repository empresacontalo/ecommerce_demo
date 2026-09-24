import { query } from '@/utils/db'

/**
 * Ordem de exibição das marcas no catálogo e vitrines.
 *
 * A ordem é salva na configuração `catalogo.ordem_marcas` (jsonb = array de
 * marcas na ordem desejada). Quando nenhuma ordem foi configurada ainda, a
 * marca principal (Lattafa) vem primeiro e as demais seguem por nome (A–Z).
 */

export const CHAVE_ORDEM_MARCAS = 'catalogo.ordem_marcas'

/** Marca exibida por padrão em primeiro lugar quando não há configuração. */
export const MARCA_PADRAO = 'Lattafa'

/** Lê a ordem de marcas salva no CMS. Retorna [] quando nada foi configurado. */
export async function getOrdemMarcas(): Promise<string[]> {
  try {
    const { rows } = await query(
      'SELECT valor FROM public.configuracoes WHERE chave = $1',
      [CHAVE_ORDEM_MARCAS]
    )
    const valor = rows[0]?.valor
    if (!Array.isArray(valor)) return []
    return valor.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch (error) {
    console.error('Erro ao ler ordem de marcas:', error)
    return []
  }
}

/** Ordem efetiva usada na exibição: a configurada, ou [MARCA_PADRAO] por padrão. */
export async function getOrdemMarcasEfetiva(): Promise<string[]> {
  const ordem = await getOrdemMarcas()
  return ordem.length > 0 ? ordem : [MARCA_PADRAO]
}

export interface OrdemMarcasSql {
  /** Snippet ORDER BY que posiciona as marcas conforme $paramIndex e, dentro da marca, por nome. */
  sql: (paramIndex: number) => string
  /** Marca(s) de destaque para o fallback SQL simples. */
  destaque: string[]
}

/**
 * Monta a cláusula ORDER BY baseada na ordem de marcas.
 *
 * - Configurada: `array_position($N, origin)` (marcas fora da lista ficam no fim) + nome A–Z.
 * - Não configurada: marca padrão (Lattafa) primeiro, depois todas por nome A–Z.
 */
export function clausulaOrdemMarcas(ordem: string[], marcaPadrao: string = MARCA_PADRAO): OrdemMarcasSql {
  if (ordem.length > 0) {
    return {
      sql: (paramIndex: number) =>
        `ORDER BY array_position($${paramIndex}::text[], origin) NULLS LAST, name ASC`,
      destaque: ordem,
    }
  }
  return {
    sql: () =>
      `ORDER BY CASE WHEN origin = '${marcaPadrao}' THEN 0 ELSE 1 END, name ASC`,
    destaque: [marcaPadrao],
  }
}

/** Aplica a ordem de marcas a uma lista de nomes (ex: opções do filtro). */
export function ordenarMarcasPorOrdem(marcas: string[], ordem: string[]): string[] {
  const posicao = new Map<string, number>()
  ordem.forEach((m, i) => { if (!posicao.has(m)) posicao.set(m, i) })
  const comOrdem = [...marcas].filter((m) => posicao.has(m))
    .sort((a, b) => (posicao.get(a) ?? 0) - (posicao.get(b) ?? 0))
  const semOrdem = [...marcas].filter((m) => !posicao.has(m))
    .sort((a, b) => a.localeCompare(b, 'pt'))
  return [...comOrdem, ...semOrdem]
}