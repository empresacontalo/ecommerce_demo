import { NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { createClient } from '@/utils/auth/server';
import { getConfigPagamento, criarCobranca, salvarIdsPagamento } from '@/utils/pagamentos';
import { resolverCupomAtivo, calcularDescontoCupom } from '@/lib/cupons';
import { calcularFreteMotoboy } from '@/utils/frete';
import { getFreteMotoboyConfig } from '@/lib/frete-config';
import { calcularDescontoFormaPagamento, VALOR_MINIMO_VENDA } from '@/utils/desconto-pagamento';
import { getDescontosPagamento } from '@/lib/desconto-config';
import { rateLimit } from '@/utils/rate-limit';

export async function POST(req: Request) {
  const rl = await rateLimit(req, 'checkout');
  if (!rl.ok) {
    return NextResponse.json({ error: rl.erro }, { status: 429 });
  }
  const decrementedItems: { id: string; quantity: number; price: number; name?: string; slug?: string; origin?: string; image?: string; descontos?: Record<string, number> | null }[] = [];
  try {
    const pagamento = await getConfigPagamento();
    const { name, email, cpf, phone, items, paymentMethod, shippingMethod = 'pac', shippingAddress = null, coupon = null, card = null } = await req.json();

    if (!pagamento.apiKey) {
      return NextResponse.json({ error: 'Token de pagamento não configurada (Configurações > Pagamento)' }, { status: 500 });
    }

    // ── Validação dos itens (anti-fraude: qtd inválida / itens vazios) ─────────────
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }
    for (const item of items) {
      const qtd = Number(item?.quantity);
      if (!item?.id || !Number.isInteger(qtd) || qtd < 1) {
        return NextResponse.json({ error: 'Quantidade inválida no carrinho' }, { status: 400 });
      }
    }

    // ── 0. Obter Preço Real e validar disponibilidade (SEM debitar estoque) ──
    // O estoque só é debitado quando o Asaas confirma o recebimento do
    // pagamento (webhook). Aqui apenas validamos que o produto existe e tem
    // quantidade disponível, e guardamos os dados REAIS vindos do banco.
    for (const item of items) {
      const { rows } = await query(
        `SELECT id, name, price, slug, origin, images, stock, descontos
         FROM public.produtos
         WHERE id = $1`,
        [item.id]
      );

      const p = rows[0];
      if (!p) {
        return NextResponse.json({ error: `Produto não encontrado.` }, { status: 400 });
      }
      if (Number(p.stock) < Number(item.quantity)) {
        return NextResponse.json(
          { error: `Estoque insuficiente para o produto "${p.name}". Disponível: ${p.stock}.` },
          { status: 400 }
        );
      }
      if (Number(p.price) < VALOR_MINIMO_VENDA) {
        return NextResponse.json(
          { error: `O produto "${p.name}" não pode ser vendido: o valor (R$ ${Number(p.price).toFixed(2)}) é menor que o mínimo aceito (R$ ${VALOR_MINIMO_VENDA.toFixed(2)}).` },
          { status: 400 }
        );
      }

      // Guarda os dados REAIS do produto vindos do banco (nunca os do cliente),
      // para o pedido exibir nome/imagem/origem/preço corretos no admin e no e-mail.
      const imagem = Array.isArray(p.images) && p.images.length > 0
        ? (typeof p.images[0] === 'string' ? p.images[0] : (p.images[0]?.url || ''))
        : `/produtos/${p.slug || item.id}.jpg`;
      decrementedItems.push({
        id: item.id,
        quantity: item.quantity,
        price: Number(p.price),
        name: p.name || 'Produto',
        slug: p.slug || '',
        origin: p.origin || '',
        image: imagem,
        descontos: (typeof p.descontos === 'object' && p.descontos && !Array.isArray(p.descontos)) ? p.descontos : null,
      });
    }

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch (e) {
      console.warn('[Checkout] Failed to retrieve authenticated user:', e);
    }

    // ── Calcular Total e Frete no Backend de forma Segura ────────────────────────
    const subtotal = decrementedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

    // Cupom real (campanha ativa), com escopo (todos/marca/produtos) aplicado
    // apenas aos itens elegíveis. Nunca confia no valor enviado pelo cliente.
    let discountPercent = 0;
    let cupomAplicado: string | null = null;
    let cupomInfo = null;
    if (coupon && typeof coupon === 'string' && coupon.trim() !== '') {
      const cupom = await resolverCupomAtivo(coupon);
      if (cupom && cupom.descontoPercent > 0) {
        discountPercent = cupom.descontoPercent;
        cupomAplicado = cupom.codigo;
        cupomInfo = cupom;
      }
    }
    const discountAmount = cupomInfo
      ? calcularDescontoCupom(
          decrementedItems.map((i: any) => ({ id: i.id, origin: i.origin, price: i.price, quantity: i.quantity })),
          cupomInfo
        ).descontoValor
      : subtotal * (discountPercent / 100);

    // Desconto por forma de pagamento (PIX/Cartão/Boleto) — o valor cobrado
    // no QRCode/boleto/cartão já sai com o desconto (maior entre o Desconto
    // Geral e o do produto). Antifraude: calculado no servidor.
    const descontoGeralPagamento = await getDescontosPagamento();
    const { descontoForma } = calcularDescontoFormaPagamento(
      decrementedItems.map((i: any) => ({ id: i.id, price: i.price, quantity: i.quantity, descontos: i.descontos })),
      paymentMethod,
      descontoGeralPagamento
    );

    // Desconto total do pedido = cupom + forma de pagamento.
    let descontoTotal = Number((discountAmount + descontoForma).toFixed(2));

    // Valor mínimo de cobrança do Asaas: R$ 5,00. Se o desconto derrubar o
    // subtotal abaixo disso, NÃO se aplica nenhum desconto (cobra o valor cheio,
    // que já é >= R$ 5,00 por construção — produtos < R$ 5 são recusados).
    if (subtotal - descontoTotal < VALOR_MINIMO_VENDA) {
      descontoTotal = 0;
    }

    let realShipping = 25.90;
    if (shippingMethod === 'sedex') realShipping = 48.90;
    else if (shippingMethod === 'motoboy') {
      // Antifraude: motoboy só existe para os municípios configurados
      // (Praia Grande/São Vicente/Santos por padrão). O valor é recalculado
      // aqui a partir do endereço + config do CMS, nunca confiado no client.
      const tabelaMotoboy = await getFreteMotoboyConfig();
      const frete = calcularFreteMotoboy(shippingAddress?.city, shippingAddress?.state, tabelaMotoboy);
      if (!frete.disponivel) {
        return NextResponse.json(
          { error: 'Entrega por motoboy não disponível para este endereço.' },
          { status: 400 }
        );
      }
      realShipping = frete.valor;
    }
    else if (shippingMethod === 'retirada') realShipping = 0;

    const finalTotalPrice = Number((subtotal - descontoTotal + realShipping).toFixed(2));

    if (finalTotalPrice <= 0) {
      return NextResponse.json({ error: 'Informe um valor maior que R$ 0,00.' }, { status: 400 });
    }

    // ── 1. Salvar Pedido com Status PENDING ───────────────────────
    let orderId = null;
    try {
      const { rows: orderRows } = await query(
        `INSERT INTO public.orders (
          user_id,
          customer_name,
          customer_email,
          customer_cpf,
          customer_phone,
          items,
          subtotal,
          discount,
          shipping,
          total_price,
          payment_method,
          status,
          shipping_method,
          shipping_address,
          coupon
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [
          userId,
          name,
          email,
          cpf,
          phone,
          JSON.stringify(decrementedItems),
          subtotal,
          descontoTotal,
          realShipping,
          finalTotalPrice,
          paymentMethod,
          'RECEBIDO',
          shippingMethod,
          shippingAddress ? JSON.stringify(shippingAddress) : null,
          cupomAplicado
        ]
      );
      orderId = orderRows[0].id;
    } catch (dbError: any) {
      console.error('[Checkout] Database insert error:', dbError.message);
      throw new Error('Falha ao registrar pedido no sistema. Tente novamente.');
    }

    // ── 1b. Kanban: introduz o cliente no kanban de vendas ──────────
    // Cliente iniciou o checkout com intenção de compra → entra na
    // fase 'Interessado' (ou avança da fase atual). Nunca quebra o
    // checkout em caso de falha.
    try {
      const { sincronizarLeadComPedido } = await import('@/utils/lead-pedido');
      const sync = await sincronizarLeadComPedido({ nome: name, email, telefone: phone, pedidoId: orderId });
      if (sync.ok) console.log(`[Checkout] Lead sincronizado no kanban para o pedido ${orderId}`);
      else console.warn(`[Checkout] Kanban não atualizado (${sync.motivo}) — pedido ${orderId} segue sem lead.`);
    } catch (e: any) {
      console.warn('[Checkout] Falha ao sincronizar lead no kanban:', e?.message);
    }

    // ── 2. Criar Cliente + Cobrança no provedor de pagamento ─────────
    const resultado = await criarCobranca({
      cliente: { name, email, cpf, phone },
      valor: finalTotalPrice,
      descricao: `Pedido #${orderId} - ${items.length} itens`,
      metodo: paymentMethod === 'credit' ? 'credit' : paymentMethod === 'boleto' ? 'boleto' : 'pix',
      pedidoId: orderId,
      card,
    });

    // ── 3. Atualizar Pedido com IDs do provedor ───────────────────────
    try {
      await salvarIdsPagamento(
        orderId,
        resultado.paymentId,
        resultado.invoiceUrl,
        resultado.pixQrCodePayload,
        resultado.boletoUrl,
        resultado.boletoLinha
      );
    } catch (dbError: any) {
      console.error('[Checkout] Database update error after payment:', dbError.message);
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: resultado.paymentId,
        invoiceUrl: resultado.invoiceUrl,
        pixQrCodePayload: resultado.pixQrCodePayload,
        pixQrCodeUrl: resultado.pixQrCodeUrl,
        boletoUrl: resultado.boletoUrl,
        boletoLinhaDigitavel: resultado.boletoLinha,
        provedor: pagamento.provedor,
        modo: pagamento.modo,
      },
    });

  } catch (error: any) {
    // Nada a reverter no estoque: ele só é debitado após o pagamento ser
    // recebido (webhook). Erros aqui (Asaas, banco) não afetam o estoque.
    console.error('[Checkout] API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
