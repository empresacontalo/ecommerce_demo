import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';
import { notificarStatusPedido } from '@/utils/pedido-emails';

// GET /api/admin/orders?busca=&status=&pagamento=&envio=&rastreio=&data_inicio=&data_fim=&ordenar=&limite=
// Lista pedidos com busca por cliente/ID e filtros combináveis por status,
// forma de pagamento, método de envio, presença de rastreio e período.
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const busca = (searchParams.get('busca') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const pagamento = (searchParams.get('pagamento') || '').trim();
    const envio = (searchParams.get('envio') || '').trim();
    const rastreio = (searchParams.get('rastreio') || '').trim();
    const dataInicio = (searchParams.get('data_inicio') || '').trim();
    const dataFim = (searchParams.get('data_fim') || '').trim();
    const ordenar = (searchParams.get('ordenar') || 'recentes').trim();
    const limite = Number(searchParams.get('limite') || 200);

    let sql = `SELECT * FROM public.orders`;
    const conds: string[] = [];
    const params: unknown[] = [];

    if (busca) {
      params.push(`%${busca}%`);
      conds.push(`(customer_name ILIKE $${params.length} OR customer_email ILIKE $${params.length} OR id::text ILIKE $${params.length})`);
    }
    if (status && status !== 'Todos') {
      params.push(status);
      conds.push(`status = $${params.length}`);
    }
    if (pagamento && pagamento !== 'Todos') {
      params.push(pagamento);
      conds.push(`payment_method = $${params.length}`);
    }
    if (envio && envio !== 'Todos') {
      params.push(envio);
      conds.push(`shipping_method = $${params.length}`);
    }
    if (rastreio === 'com') {
      conds.push(`(tracking_code IS NOT NULL AND tracking_code <> '' OR tracking_link IS NOT NULL AND tracking_link <> '')`);
    } else if (rastreio === 'sem') {
      conds.push(`(tracking_code IS NULL OR tracking_code = '') AND (tracking_link IS NULL OR tracking_link = '')`);
    }
    if (dataInicio) {
      params.push(dataInicio);
      conds.push(`created_at >= $${params.length}::date`);
    }
    if (dataFim) {
      params.push(dataFim);
      conds.push(`created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    if (ordenar === 'recentes') sql += ` ORDER BY created_at DESC`;
    else if (ordenar === 'antigos') sql += ` ORDER BY created_at ASC`;
    else if (ordenar === 'maior_valor') sql += ` ORDER BY total_price DESC`;
    else if (ordenar === 'menor_valor') sql += ` ORDER BY total_price ASC`;
    else sql += ` ORDER BY created_at DESC`;
    sql += ` LIMIT ${Math.min(Math.max(limite, 1), 1000)}`;

    const result = await query(sql, params);
    const safeRows = admin.readOnly
      ? result.rows.map((r: any) => ({
          ...r,
          customer_email: r.customer_email ? String(r.customer_email).replace(/(^.).*(@.*$)/, '$1***$2') : null,
          customer_phone: r.customer_phone ? '***-***-' + String(r.customer_phone).slice(-4) : null,
          customer_cpf: r.customer_cpf ? '***.***.***-**' : null,
          shipping_address: r.shipping_address ? '[Redacted in read-only demo]' : null,
        }))
      : result.rows;
    return NextResponse.json(safeRows);
  } catch (err) {
    console.error('Erro ao listar pedidos:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/admin/orders — Atualiza status, método de envio e rastreamento
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { id, status, shipping_method, tracking_code, tracking_link } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    // Estado anterior (para só notificar quando houver mudança real)
    const antes = await query('SELECT id, customer_name, customer_email, status, tracking_code, tracking_link FROM public.orders WHERE id = $1', [id]);
    if (antes.rows.length === 0) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    const antesRow = antes.rows[0];

    const result = await query(
      `UPDATE public.orders
       SET status = COALESCE($2, status),
           shipping_method = COALESCE($3, shipping_method),
           tracking_code = COALESCE($4, tracking_code),
           tracking_link = COALESCE($5, tracking_link)
       WHERE id = $1 RETURNING *`,
      [id, status || null, shipping_method || null, tracking_code || null, tracking_link || null]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    const novoObj = result.rows[0];

    // Notifica o cliente quando o status mudou ou o rastreio foi salvo/alterado
    const statusMudou = status && status !== antesRow.status;
    const rastreioMudou = (tracking_code !== undefined && antesRow.tracking_code !== novoObj.tracking_code)
      || (tracking_link !== undefined && antesRow.tracking_link !== novoObj.tracking_link);
    if (statusMudou || rastreioMudou) {
      // 1. E-mail automático com o rastreio (código Correios ou link do entregador)
      const res = await notificarStatusPedido({
        id: novoObj.id,
        customer_name: novoObj.customer_name,
        customer_email: novoObj.customer_email,
        status: novoObj.status,
        tracking_code: novoObj.tracking_code,
        tracking_link: novoObj.tracking_link,
        shipping_method: novoObj.shipping_method,
        total_price: novoObj.total_price,
      });
      console.log(`[Pedidos] Notificação ${novoObj.id}:`, res);

      // 2. Quando ENVIADO com rastreio, solicita ao agente informar o cliente
      //    (mensagem proativa na caixa do agente — chega ao WhatsApp quando
      //    a caixa de entrada do WhatsApp estiver conectada ao agente).
      if (novoObj.status === 'ENVIADO' && (novoObj.tracking_code || novoObj.tracking_link)) {
        try {
          const { solicitarAgenteInformarEnvio } = await import('@/utils/solicitar-agente');
          const resAgente = await solicitarAgenteInformarEnvio({
            pedidoId: novoObj.id,
            clienteNome: novoObj.customer_name,
            clienteEmail: novoObj.customer_email,
            clienteTelefone: novoObj.customer_phone,
          });
          console.log(`[Pedidos] Agente ${novoObj.id}:`, resAgente);
        } catch (err) {
          console.error('[Pedidos] Falha ao acionar agente:', err);
        }
      }
    }

    return NextResponse.json(novoObj);
  } catch (err) {
    console.error('Erro ao atualizar pedido:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
