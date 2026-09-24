import { query } from '@/utils/db';

/**
 * Discount coupons per campaign (Fragrance E-commerce Demo).
 *
 * Cada campanha pode ter um cupom próprio (`cupom_codigo`, escopo
 * todos/marca/produtos). O percentual de desconto é o próprio campo
 * `desconto` da campanha (texto, ex "15%"). O cupom só vale quando:
 *   - a campanha está ativa (ativo=true) e dentro do período; e
 *   - o cliente digita o código no cupom do carrinho (não é automático).
 *
 * Funções puras (gerar código, parse do percentual, cálculo por escopo) ficam
 * aqui sem depender do banco — nas funções síncronas somente.
 */

export type EscopoCupom = 'todos' | 'marca' | 'produtos';

export interface CupomInfo {
  codigo: string;
  descontoPercent: number;
  escopo: EscopoCupom;
  marca: string | null;
  produtos: string[];
}

/** Max de caracteres do código do cupom. */
export const LIMITE_CODIGO_CUPOM = 16;

/**
 * Gera um código de cupom "inspirado" no nome da campanha, no máximo
 * LIMITE_CODIGO_CUPOM caracteres, ALFANUMÉRICO MAIÚSCULO.
 * Ex: "Dia dos Pais 2026" → "DIADOSPAIS2026".
 */
export function gerarCodigoCupom(titulo: string, limite: number = LIMITE_CODIGO_CUPOM): string {
  const base = (titulo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // só alfanuméricos
  if (!base) return 'CUPOM';
  return base.slice(0, limite);
}

/** Extrai o percentual de um texto de desconto: "15%" → 15. Aceita vírgula e espaço. */
export function parseDescontoPercent(desconto: string | null | undefined): number {
  if (!desconto) return 0;
  const m = String(desconto).replace(/[^\d.,]/g, '').replace(',', '.');
  const v = parseFloat(m);
  return Number.isFinite(v) ? v : 0;
}

/** Verifica se um produto (pela marca e id) é elegível para o cupom. */
export function produtoElegivel(
  origin: string | null | undefined,
  id: string,
  cupom: Pick<CupomInfo, 'escopo' | 'marca' | 'produtos'>
): boolean {
  if (cupom.escopo === 'marca') {
    return Boolean(cupom.marca) && (origin || '').trim().toLowerCase() === cupom.marca!.trim().toLowerCase();
  }
  if (cupom.escopo === 'produtos') {
    return Array.isArray(cupom.produtos) && cupom.produtos.includes(id);
  }
  return true; // todos
}

/**
 * Calcula o total elegível e o desconto em reais para uma lista de itens.
 * items: [{ id, origin, price, quantity }]
 */
export function calcularDescontoCupom(
  items: { id: string; origin?: string | null; price: number; quantity: number }[],
  cupom: CupomInfo
): { subtotalElegivel: number; descontoValor: number } {
  const subtotalElegivel = items.reduce((soma, item) => {
    if (!produtoElegivel(item.origin, item.id, cupom)) return soma;
    return soma + (Number(item.price) || 0) * (Number(item.quantity) || 0);
  }, 0);
  const percent = Math.max(0, Math.min(100, cupom.descontoPercent));
  const descontoValor = subtotalElegivel * (percent / 100);
  return { subtotalElegivel, descontoValor: Number(descontoValor.toFixed(2)) };
}

/**
 * Resolve um cupom no banco: retorna a campanha ativa (e dentro do período)
 * cujo cupom_codigo bate com o código digitado, com `desconto` convertido.
 * Retorna null se não houver campanha ativa com esse cupom.
 */
export async function resolverCupomAtivo(codigo: string): Promise<CupomInfo | null> {
  const upper = (codigo || '').toUpperCase().trim();
  if (!upper) return null;

  const { rows } = await query(
    `SELECT cupom_codigo, desconto, cupom_escopo, cupom_marca, cupom_produtos
     FROM public.campanhas
     WHERE ativo = true
       AND cupom_codigo IS NOT NULL
       AND UPPER(cupom_codigo) = $1
       AND (data_inicio IS NULL OR data_inicio <= NOW())
       AND (data_fim IS NULL OR data_fim >= NOW())
     ORDER BY prioridade ASC, created_at DESC
     LIMIT 1`,
    [upper]
  );

  const camp = rows[0];
  if (!camp || !camp.cupom_codigo) return null;

  const escopo: EscopoCupom = camp.cupom_escopo === 'marca' || camp.cupom_escopo === 'produtos'
    ? camp.cupom_escopo
    : 'todos';

  return {
    codigo: String(camp.cupom_codigo).toUpperCase(),
    descontoPercent: parseDescontoPercent(camp.desconto),
    escopo,
    marca: camp.cupom_marca || null,
    produtos: Array.isArray(camp.cupom_produtos) ? camp.cupom_produtos.map(String) : [],
  };
}