import { query } from '@/utils/db';

/**
 * Kanban automatizado de vendas (funil de compra).
 *
 * Fluxo:
 *  1. Cliente se cadastra no site (formulário de desconto) → lead entra
 *     no kanban como 'Novo' (registerLead, já existente).
 *  2. Cliente inicia o checkout (intenção de compra) → o lead é
 *     introduzido/atualizado para 'Interessado' e o pedido fica ligado
 *     a ele (orders.lead_id).
 *  3. Pagamento confirmado (webhook Asaas) → lead movido para
 *     'Convertido'.
 *
 * Abandono de carrinho NÃO é tratado aqui: um agente de IA monitora o
 * kanban (via MCP listar_leads/atualizar_status_lead) usando
 * etapa_atualizada_em para medir o tempo sem conclusão e assume o
 * tratamento do lead.
 *
 * Nenhuma função aqui lança erro: o checkout/webhook não podem quebrar
 * por causa da sincronização do kanban.
 */

/** Fases do kanban (ordem do funil). */
export const FASES_KANBAN = {
  NOVO: 'Novo',
  EM_CONTATO: 'Em Contato',
  INTERESSADO: 'Interessado',
  PROPOSTA: 'Proposta Enviada',
  CONVERTIDO: 'Convertido',
  POS_VENDA: 'Pós-venda',
  INATIVO: 'Inativo',
} as const;

/** Fases que podem avançar para 'Interessado' quando o cliente compra. */
const FASES_QUE_AVANCAM_PARA_INTERESSADO = new Set<string>([FASES_KANBAN.NOVO, FASES_KANBAN.EM_CONTATO]);

/** Gera variantes do telefone (com/sem DDI 55) para casar com o banco. */
function variantesTelefone(v?: string | null): string[] {
  const d = String(v || '').replace(/\D/g, '').slice(0, 13);
  if (!d) return [];
  const s = new Set<string>();
  s.add(d);
  if (d.length === 12 && d.startsWith('55')) s.add(d.slice(2));
  if (d.length >= 10 && d.length <= 11) s.add(`55${d}`);
  return [...s];
}

async function buscarLeadPorContato(input: { telefone?: string | null; email?: string | null }): Promise<Array<{ id: string; status: string; score: number | null }>> {
  const email = input.email?.trim().toLowerCase() || null;
  const conds: string[] = [];
  const params: unknown[] = [];
  const variantes = variantesTelefone(input.telefone);
  if (variantes.length) {
    params.push(variantes);
    conds.push(`regexp_replace(phone, '\D', '', 'g') = ANY($${params.length})`);
  }
  if (email) {
    params.push(email);
    conds.push(`lower(email) = $${params.length}`);
  }
  if (!conds.length) return [];
  const { rows } = await query(
    `SELECT * FROM public.leads WHERE ${conds.join(' OR ')} ORDER BY created_at DESC LIMIT 1`,
    params
  );
  return (rows ?? []) as Array<{ id: string; status: string; score: number | null }>;
}

interface DadosSincronizacaoPedido {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  pedidoId: string;
}

/**
 * Introduz o cliente no kanban na fase 'Interessado' quando ele inicia
 * o checkout. Reaproveita o lead existente (mesmo telefone ou e-mail),
 * liga o pedido ao lead e registra quando a fase mudou.
 */
export async function sincronizarLeadComPedido(dados: DadosSincronizacaoPedido): Promise<{ ok: boolean; lead?: unknown; motivo?: string }> {
  try {
    const existentes = await buscarLeadPorContato({ telefone: dados.telefone, email: dados.email });
    const existente = existentes[0] ?? null;

    let lead: { id: string; status: string; score: number | null } | null = existente ? { id: existente.id, status: existente.status, score: existente.score ?? null } : null;
    if (lead) {
      const avanca = FASES_QUE_AVANCAM_PARA_INTERESSADO.has(lead.status);
      const novoStatus = avanca ? FASES_KANBAN.INTERESSADO : lead.status;
      const novoScore = Math.max(Number(lead.score) || 0, 80);
      const { rows } = await query(
        `UPDATE public.leads
         SET status = $1,
             score = $2,
             last_contact = NOW(),
             etapa_atualizada_em = CASE WHEN status <> $1 THEN NOW() ELSE etapa_atualizada_em END
         WHERE id = $3
         RETURNING *`,
        [novoStatus, novoScore, lead.id]
      );
      lead = rows[0] ?? lead;
    } else {
      const tel = dados.telefone?.trim() || null;
      const email = dados.email?.trim().toLowerCase() || null;
      const { rows } = await query(
        `INSERT INTO public.leads (name, phone, email, source, status, score, last_contact, etapa_atualizada_em)
         VALUES ($1, $2, $3, 'Loja', 'Interessado', 80, NOW(), NOW())
         RETURNING *`,
        [dados.nome?.trim() || 'Cliente da loja', tel, email]
      );
      lead = rows[0] ?? null;
    }

    if (lead?.id) {
      await query('UPDATE public.orders SET lead_id = $1 WHERE id = $2', [lead.id, dados.pedidoId]);
    }
    return { ok: true, lead };
  } catch (err) {
    console.error('[lead-pedido] sincronizarLeadComPedido erro:', err);
    return { ok: false, motivo: 'falha ao sincronizar lead' };
  }
}

/**
 * Move o lead para 'Convertido' quando o pagamento é confirmado
 * (webhook Asaas). Usa o vínculo orders.lead_id; para pedidos antigos
 * sem vínculo, tenta encontrar o lead pelo telefone/e-mail do pedido.
 */
export async function marcarLeadConvertido(pedido: {
  id: string;
  lead_id?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
}): Promise<{ ok: boolean; motivo?: string }> {
  try {
    let leadId = pedido.lead_id ?? null;
    if (!leadId) {
      const existentes = await buscarLeadPorContato({ telefone: pedido.customer_phone, email: pedido.customer_email });
      leadId = existentes[0]?.id ?? null;
    }
    if (!leadId) return { ok: false, motivo: 'lead não encontrado' };

    await query(
      `UPDATE public.leads
       SET status = 'Convertido', score = 100, last_contact = NOW(), etapa_atualizada_em = NOW()
       WHERE id = $1`,
      [leadId]
    );
    return { ok: true };
  } catch (err) {
    console.error('[lead-pedido] marcarLeadConvertido erro:', err);
    return { ok: false, motivo: 'falha ao mover lead' };
  }
}