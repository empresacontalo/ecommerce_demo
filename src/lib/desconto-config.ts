import { query } from '@/utils/db';
import { DescontosPorForma } from '@/utils/desconto-pagamento';

export const CHAVE_DESCONTOS_PAGAMENTO = 'descontos.pagamento';

export const DESCONTOS_PADRAO: DescontosPorForma = { pix: 5, credit: 0, boleto: 0 };

/**
 * Lê a configuração `descontos.pagamento` (Desconto Geral por forma) do CMS.
 * Retorna o objeto normalizado; se ausente/inválido, usa o padrão (5% no PIX).
 */
export async function getDescontosPagamento(): Promise<DescontosPorForma> {
  try {
    const { rows } = await query(
      'SELECT valor FROM public.configuracoes WHERE chave = $1',
      [CHAVE_DESCONTOS_PAGAMENTO]
    );
    const v = rows[0]?.valor;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const out: DescontosPorForma = {};
      for (const forma of ['pix', 'credit', 'boleto'] as const) {
        const n = Number((v as DescontosPorForma)[forma]);
        if (Number.isFinite(n)) out[forma] = n;
      }
      if (out.pix !== undefined || out.credit !== undefined || out.boleto !== undefined) {
        return out;
      }
    }
  } catch (err) {
    console.error('Erro ao ler config descontos.pagamento:', err);
  }
  return { ...DESCONTOS_PADRAO };
}