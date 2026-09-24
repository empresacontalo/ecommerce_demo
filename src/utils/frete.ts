/**
 * Frete por motoboy (Baixada Santista).
 *
 * Municípios e taxas são definidos na configuração `frete.motoboy` do CMS
 * (editável sem deploy). Quando a config não existe/está inválida, usa a
 * tabela padrão deste arquivo:
 *   - Praia Grande:  R$ 15,00
 *   - São Vicente:   R$ 25,00
 *   - Santos:        R$ 35,00
 * Para qualquer outro município, o motoboy NÃO está disponível.
 *
 * Funções puras, compartilhadas entre o checkout (client) e a API (server).
 */

export interface FreteMotoboy {
  disponivel: boolean;
  valor: number;
  municipio: string | null;
}

/** Formato salvo na config `frete.motoboy`: lista { cidade, valor } em R$. */
export interface TabelaMotoboyItem {
  cidade: string;
  valor: number;
}

export type TabelaMotoboy = Record<string, number>;

// Nome já normalizado (minúsculo, sem acentos) → valor.
export const TABELA_MOTOBOY_PADRAO: TabelaMotoboy = {
  'praia grande': 15,
  'sao vicente': 25,
  santos: 35,
};

export const MOTOBOY_PRAIA_GRANDE = 15;
export const MOTOBOY_SAO_VICENTE = 25;
export const MOTOBOY_SANTOS = 35;

export const MUNICIPIOS_MOTOBOY = Object.keys(TABELA_MOTOBOY_PADRAO).map(
  (m) => m.replace(/^./, (c) => c.toUpperCase())
);

function normalizar(texto: string | null | undefined): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Converte o valor da config `frete.motoboy` (array [{cidade, valor}]) numa
 * tabela normalizada. Retorna null se o valor não for reconhecível.
 */
export function parseTabelaMotoboy(valor: unknown): TabelaMotoboy | null {
  if (Array.isArray(valor)) {
    const tabela: TabelaMotoboy = {};
    let ok = false;
    for (const item of valor) {
      if (!item || typeof item !== 'object') continue;
      const cidade = (item as TabelaMotoboyItem).cidade;
      const v = Number((item as TabelaMotoboyItem).valor);
      const chave = normalizar(cidade);
      if (chave && Number.isFinite(v) && v >= 0) {
        tabela[chave] = v;
        ok = true;
      }
    }
    return ok ? tabela : null;
  }
  if (valor && typeof valor === 'object') {
    // Aceita também objeto chave:valor direto (ex: {"Praia Grande": 15})
    const tabela: TabelaMotoboy = {};
    let ok = false;
    for (const [cidade, v] of Object.entries(valor as Record<string, unknown>)) {
      const chave = normalizar(cidade);
      const num = Number(v);
      if (chave && Number.isFinite(num) && num >= 0) {
        tabela[chave] = num;
        ok = true;
      }
    }
    return ok ? tabela : null;
  }
  return null;
}

/** Tabela efetiva: a configurada (quando válida) ou a padrão. */
export function tabelaMotoboyEfetiva(tabela: TabelaMotoboy | null | undefined): TabelaMotoboy {
  return tabela && Object.keys(tabela).length > 0 ? tabela : TABELA_MOTOBOY_PADRAO;
}

/**
 * Calcula o frete de motoboy para um endereço.
 * - estado diferente de SP → não disponível.
 * - município fora da tabela → não disponível.
 * - `tabela` sobrescreve a padrão (vem da config `frete.motoboy`).
 * Retorna o valor configurado e o nome do município quando disponível.
 */
export function calcularFreteMotoboy(
  cidade: string | null | undefined,
  estado: string | null | undefined,
  tabela?: TabelaMotoboy | null
): FreteMotoboy {
  const uf = normalizar(estado) || '';
  if (uf && uf !== 'sp') {
    return { disponivel: false, valor: 0, municipio: null };
  }

  const tabelaEfetiva = tabelaMotoboyEfetiva(tabela);
  const cidadeNorm = normalizar(cidade);
  const entrada = tabelaEfetiva[cidadeNorm];
  if (entrada === undefined) {
    return { disponivel: false, valor: 0, municipio: null };
  }

  return { disponivel: true, valor: entrada, municipio: (cidade || '').trim() };
}

/** Alias de conveniência para os pontos que só precisam saber se está disponível. */
export function motoboyDisponivel(
  cidade: string | null | undefined,
  estado: string | null | undefined,
  tabela?: TabelaMotoboy | null
): boolean {
  return calcularFreteMotoboy(cidade, estado, tabela).disponivel;
}