/**
 * Desconto por forma de pagamento (PIX / Cartão / Boleto).
 *
 * Fonte de verdade no servidor (checkout): o valor cobrado no QRCode/boleto/
 * cartão no Asaas já sai com o desconto aplicado. Este módulo é puro (sem DB)
 * e compartilhado entre a UI (exibição) e o servidor (cobrança).
 *
 * Regras:
 *  - Desconto Geral (config `descontos.pagamento`) se aplica a todos produtos.
 *  - O produto pode ter `descontos` próprio (jsonb) por forma.
 *  - Quando ambos definem a mesma forma, vale o MAIOR dos dois.
 */

export type FormaPagamentoDesconto = 'pix' | 'credit' | 'boleto';

export const FORMAS_DESCONTO: FormaPagamentoDesconto[] = ['pix', 'credit', 'boleto'];

/**
 * Valor mínimo de venda/cobrança. O Asaas recusa cobranças abaixo de R$ 5,00,
 * então um produto não pode ser cadastrado com preço menor que este, e o
 * checkout recusa itens abaixo deste valor.
 */
export const VALOR_MINIMO_VENDA = 5;

export interface DescontosPorForma {
  pix?: number | null;
  credit?: number | null;
  boleto?: number | null;
}

/** Normaliza a forma recebida do body (ex: 'credit'|'pix'|'boleto') → chave de desconto. */
export function normalizarFormaPagamento(forma: string | null | undefined): FormaPagamentoDesconto | null {
  const f = (forma || '').toLowerCase().trim();
  if (f === 'pix') return 'pix';
  if (f === 'credit' || f === 'cartao' || f === 'credit_card') return 'credit';
  if (f === 'boleto') return 'boleto';
  return null;
}

/** Lê um valor numérico seguro de um objeto de descontos. */
function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Percentual efetivo de desconto para um produto numa forma de pagamento.
 * maior(descontoGeral[forma], descontoProduto[forma]).
 */
export function percentDescontoEfetivo(
  forma: FormaPagamentoDesconto,
  descontoGeral: DescontosPorForma | null | undefined,
  descontoProduto: DescontosPorForma | null | undefined
): number {
  const geral = num(descontoGeral?.[forma]);
  const produto = num(descontoProduto?.[forma]);
  const maximo = Math.max(geral, produto);
  return Math.max(0, Math.min(100, maximo));
}

/**
 * Aplica o desconto de uma forma de pagamento a uma lista de itens.
 * Retorna o total de desconto em R$ (somado por item).
 */
export function calcularDescontoFormaPagamento(
  itens: { id: string; price: number; quantity: number; descontos?: DescontosPorForma | null }[],
  forma: string | null | undefined,
  descontoGeral: DescontosPorForma | null | undefined
): { descontoForma: number } {
  const f = normalizarFormaPagamento(forma);
  if (!f) return { descontoForma: 0 };

  let descontoForma = 0;
  for (const item of itens) {
    const pct = percentDescontoEfetivo(f, descontoGeral, item.descontos);
    if (pct <= 0) continue;
    const subtotalItem = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    descontoForma += subtotalItem * (pct / 100);
  }
  descontoForma = Number(descontoForma.toFixed(2));
  return { descontoForma };
}

/** Valor com desconto exibido de um produto (página do produto). */
export function calcularPrecoComDesconto(
  preco: number,
  forma: FormaPagamentoDesconto,
  descontoGeral: DescontosPorForma | null | undefined,
  descontoProduto: DescontosPorForma | null | undefined
): { percent: number; precoComDesconto: number } {
  const percent = percentDescontoEfetivo(forma, descontoGeral, descontoProduto);
  const precoNum = Number(preco) || 0;
  return {
    percent,
    precoComDesconto: precoNum > 0 ? Number((precoNum * (1 - percent / 100)).toFixed(2)) : 0,
  };
}