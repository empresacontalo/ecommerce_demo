import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { notificarStatusPedido } from '@/utils/pedido-emails';
import { query } from '@/utils/db';
import { getConfiguracao } from '@/app/actions/cms';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

// Valida a assinatura do webhook Asaas v3.
// O Asaas envia o header `asaas-access-token` com o MESMO token configurado
// (ex: "whsec_...") — comparação estática direta, sendas v2antiga também suportada.
function verifySignature(rawBody: string, receivedSignature: string, secret: string): boolean {
  if (!secret) return false;

  // Modo Asaas v3: o header traz o próprio token (comparação direta).
  if (receivedSignature.length === secret.length && receivedSignature === secret) {
    return true;
  }

  // Compat (Asaas v2/webhook antigo): HMAC-SHA256 do body com o token como chave.
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(receivedSignature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Eventos do Asaas que alteram o status local do pedido.
// Eventos fora deste mapa são apenas reconhecidos (200) sem tocar no pedido
// — antes, qualquer evento desconhecido caía no default 'RECEBIDO' e podia
// rebaixar pedido já pago.
const EVENTOS_STATUS: Record<string, string> = {
  PAYMENT_RECEIVED: 'APROVADO',
  PAYMENT_CONFIRMED: 'APROVADO',
  PAYMENT_OVERDUE: 'CANCELADO',
  PAYMENT_DELETED: 'CANCELADO',
  PAYMENT_REFUNDED: 'DEVOLUCAO',
};

export async function POST(req: Request) {
  try {
    const [logo, whConfig] = await Promise.all([
      getConfiguracao('header.logo'),
      getConfiguracao('pagamento.webhook_token'),
    ]);
    const empresa = logo?.texto || EMPRESA_NOME_PADRAO;
    const secret = (whConfig?.valor as string) || process.env.ASSAAS_WEBHOOK_TOKEN || '';
    const rawBody = await req.text();
    const signature = req.headers.get('asaas-access-token') ?? '';

    // Valida assinatura obrigatoriamente
    if (!secret) {
      console.error('[Asaas Webhook] Token de webhook não configurado (Configurações > Pagamento). Rejeitando.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!verifySignature(rawBody, signature, secret)) {
      console.warn('[Asaas Webhook] Assinatura inválida');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload.event;
    const paymentId: string = payload.payment?.id;
    const paymentStatus: string = payload.payment?.status;
    const externalReference: string = payload.payment?.externalReference || '';

    console.log(`[Asaas Webhook] ${eventName} | paymentId: ${paymentId} | status: ${paymentStatus}`);

    if (!eventName || !paymentId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Evento sem impacto no pedido: reconhece e encerra (sem alterar status).
    const newStatus = EVENTOS_STATUS[eventName];
    if (!newStatus) {
      console.log(`[Asaas Webhook] Evento ignorado (sem alteração de status): ${eventName}`);
      return NextResponse.json({ received: true, event: eventName, ignorado: 'evento_sem_mapeamento' });
    }

    // Atualiza pedido via raw PostgreSQL e retorna os dados.
    // Casa pelo asaas_payment_id OU pelo externalReference (= id do pedido),
    // reconciliando cobranças que ficaram sem vínculo no checkout.
    let order: any = null;
    let oldStatus: string | null = null;
    try {
      const statusRes = await query(
        'SELECT status FROM public.orders WHERE asaas_payment_id = $1 OR id::text = $2',
        [paymentId, externalReference]
      );
      if (statusRes.rows.length > 0) {
        oldStatus = statusRes.rows[0].status;
      }

      const { rows } = await query(
        `UPDATE public.orders
         SET status = $1,
             updated_at = NOW(),
             asaas_payment_id = COALESCE(asaas_payment_id, $2)
         WHERE asaas_payment_id = $2 OR id::text = $3
         RETURNING *`,
        [newStatus, paymentId, externalReference]
      );
      order = rows[0];
    } catch (err: any) {
      console.error('[Asaas Webhook] Database update error:', err.message);
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }

    // Estoque: debita apenas quando o pagamento é recebido (APROVADO).
    // Devolve quando o pedido pago é cancelado/devolvido. Um pedido criado
    // mas não pago (RECEBIDO) nunca mexeu no estoque — abandonos de carrinho
    // (PIX não pago, cartão recusado etc.) não impactam o estoque.
    const items = Array.isArray(order?.items) ? order.items : [];

    if (newStatus === 'APROVADO' && oldStatus !== 'APROVADO') {
      try {
        for (const item of items) {
          if (item.id && item.quantity) {
            await query(
              `UPDATE public.produtos
               SET stock = stock - $1,
                   stock_status = CASE WHEN stock - $1 > 0 THEN 'Em estoque' ELSE 'Indisponível' END
               WHERE id = $2 AND stock >= $1`,
              [item.quantity, item.id]
            );
          }
        }
        console.log(`[Asaas Webhook] Estoque debitado pelo pagamento do pedido ${order.id}`);
      } catch (err: any) {
        console.error('[Asaas Webhook] Erro ao debitar estoque:', err.message);
      }
    }

    // Devolve estoque apenas se já tinha sido debitado (pedido pago → agora cancelado/devolução)
    if (['CANCELADO', 'DEVOLUCAO'].includes(newStatus) && order && oldStatus === 'APROVADO') {
      try {
        for (const item of items) {
          if (item.id && item.quantity) {
            await query(
              `UPDATE public.produtos
               SET stock = stock + $1,
                   stock_status = CASE WHEN stock + $1 > 0 THEN 'Em estoque' ELSE 'Indisponível' END
               WHERE id = $2`,
              [item.quantity, item.id]
            );
          }
        }
        console.log(`[Asaas Webhook] Estoque estornado (reembolso/cancelamento) do pedido ${order.id}`);
      } catch (err: any) {
        console.error('[Asaas Webhook] Erro ao estornar estoque:', err.message);
      }
    }

    if (!order) {
      // Cobrança sem pedido correspondente (ex.: criada fora do site).
      // Responde 200 para o Asaas não pausar a fila de webhooks — antes
      // este caso devolvia 404 e foi o que interrompeu a fila.
      console.warn(
        `[Asaas Webhook] Pedido não encontrado para paymentId ${paymentId}` +
          (externalReference ? ` (externalReference: ${externalReference})` : '') +
          ' — evento reconhecido sem alteração.'
      );
      return NextResponse.json({
        received: true,
        event: eventName,
        ignorado: 'pedido_nao_encontrado',
      });
    }

    // Se o pagamento foi confirmado E antes não estava APROVADO (idempotência), envia e-mail
    if (newStatus === 'APROVADO' && oldStatus !== 'APROVADO' && order) {
      const result = await notificarStatusPedido({
        id: order.id,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        status: 'APROVADO',
        tracking_code: order.tracking_code,
        shipping_method: order.shipping_method,
        total_price: order.total_price,
      });
      console.log('[Asaas Webhook] E-mail de pagamento confirmado:', result);
    }

    // Kanban: pagamento confirmado → lead avança para 'Convertido'
    if (newStatus === 'APROVADO' && oldStatus !== 'APROVADO' && order) {
      try {
        const { marcarLeadConvertido } = await import('@/utils/lead-pedido');
        const res = await marcarLeadConvertido(order);
        console.log(`[Asaas Webhook] Lead do pedido ${order.id}:`, res.ok ? 'movido para Convertido' : `não movido (${res.motivo})`);
      } catch (err: any) {
        console.error('[Asaas Webhook] Erro ao mover lead para Convertido:', err?.message);
      }
    }

    return NextResponse.json({ received: true, event: eventName, newStatus });

  } catch (err: any) {
    console.error('[Asaas Webhook] Error:', err.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
