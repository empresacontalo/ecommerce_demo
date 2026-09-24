import { sendEmail } from '@/utils/mail';

interface PedidoEmail {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  tracking_code?: string | null;
  tracking_link?: string | null;
  shipping_method?: string | null;
  total_price?: number | string;
}

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[<>&"]/g, c => (
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as Record<string, string>)[c] || c
  ));

const empresa = () => process.env.SMTP_FROM_NAME || 'Fragrance E-commerce Demo';

/**
 * Envia e-mail de notificação de mudança de status do pedido.
 * Retorna { sent: boolean, motivo?: string } para log/debug.
 */
export async function notificarStatusPedido(pedido: PedidoEmail): Promise<{ sent: boolean; motivo?: string }> {
  const nome = escapeHtml(pedido.customer_name);
  const id = `#${pedido.id.slice(0, 8).toUpperCase()}`;
  const rastreio = pedido.tracking_code?.trim().toUpperCase();
  const rastreioLink = pedido.tracking_link?.trim();

  // Código dos Correios → link oficial; link do entregador → usa direto.
  const linkRastreio = rastreioLink
    ? (rastreioLink.startsWith('http') ? rastreioLink : `https://${rastreioLink}`)
    : rastreio
      ? `https://www.correios.com.br/rastreamento?sro=${encodeURIComponent(rastreio)}`
      : null;

  const blocoRastreio = (rastreio || linkRastreio)
    ? `
      <div style="background: #222; padding: 20px; border-radius: 4px; margin: 25px 0;">
        <h3 style="margin-top: 0; color: #D4AF37;">Código de Rastreamento</h3>
        ${rastreio ? `<p style="font-size: 18px; font-weight: 700; letter-spacing: 1px;">${escapeHtml(rastreio)}</p>` : ''}
        ${linkRastreio ? `
          <p style="font-size: 14px; color: #bbb;">
            Acompanhe em: <a href="${escapeHtml(linkRastreio)}" style="color: #D4AF37;">${rastreio ? 'Rastrear nos Correios' : 'Acompanhar entrega'} ↗</a>
          </p>` : ''}
      </div>
    `
    : '';

  let subject = '';
  let corpo = '';

  switch (pedido.status) {
    case 'APROVADO':
      subject = `Pagamento Confirmado! - ${empresa()}`;
      corpo = `
        <p>Seu pagamento foi confirmado com sucesso. Estamos muito felizes em ter você como cliente!</p>
        <div style="background: #222; padding: 20px; border-radius: 4px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #D4AF37;">Resumo do Pedido</h3>
          <p><strong>Pedido ID:</strong> ${id}</p>
          ${pedido.total_price != null ? `<p><strong>Total:</strong> R$ ${Number(pedido.total_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>` : ''}
          <hr style="border: 0; border-top: 1px solid #333; margin: 15px 0;" />
          <p>Iniciaremos a preparação do seu pedido agora mesmo. Você receberá um novo e-mail assim que seu produto for enviado.</p>
        </div>
      `;
      break;

    case 'EM_PREPARACAO':
      subject = `Seu pedido ${id} está sendo preparado! - ${empresa()}`;
      corpo = `
        <p>Seu pedido foi aprovado e já está sendo preparado com todo cuidado.</p>
        <div style="background: #222; padding: 20px; border-radius: 4px; margin: 25px 0;">
          <p><strong>Pedido:</strong> ${id}</p>
          <p>Assim que for enviado, você receberá o código de rastreamento por e-mail.</p>
        </div>
      `;
      break;

    case 'ENVIADO':
      subject = `Seu pedido ${id} foi enviado! 🚚 - ${empresa()}`;
      corpo = `
        <p>Ótima notícia: seu pedido saiu para entrega!</p>
        ${blocoRastreio || `
          <div style="background: #222; padding: 20px; border-radius: 4px; margin: 25px 0;">
            <p><strong>Pedido:</strong> ${id}</p>
            <p>Enviado via ${escapeHtml(pedido.shipping_method || 'Correios')}.</p>
          </div>
        `}
      `;
      break;

    case 'CANCELADO':
      subject = `Seu pedido ${id} foi cancelado - ${empresa()}`;
      corpo = `
        <p>Seu pedido foi cancelado.</p>
        <div style="background: #222; padding: 20px; border-radius: 4px; margin: 25px 0;">
          <p><strong>Pedido:</strong> ${id}</p>
          <p>Se você já efetuou o pagamento, o reembolso será processado pelo meio de pagamento utilizado. Em caso de dúvidas, fale com a gente pelo WhatsApp.</p>
        </div>
      `;
      break;

    case 'DEVOLUCAO':
      subject = `Seu pedido ${id} está em processo de devolução - ${empresa()}`;
      corpo = `
        <p>Estamos processando a devolução do seu pedido.</p>
        <div style="background: #222; padding: 20px; border-radius: 4px; margin: 25px 0;">
          <p><strong>Pedido:</strong> ${id}</p>
          <p>O estorno será realizado pelo meio de pagamento utilizado assim que a devolução for concluída.</p>
        </div>
      `;
      break;

    default:
      return { sent: false, motivo: `status sem template: ${pedido.status}` };
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #fff; padding: 40px; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #D4AF37; margin: 0;">${escapeHtml(empresa())}</h1>
        <p style="color: #888;">${escapeHtml(pedido.status)}</p>
      </div>

      <h2 style="color: #D4AF37;">Olá, ${nome}!</h2>
      ${corpo}

      <hr style="border: 0; border-top: 1px solid #333; margin: 25px 0;" />
      <div style="font-size: 13px; color: #888;">
        <p style="margin: 4px 0;"><strong>Pedido:</strong> ${id}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> ${escapeHtml(pedido.status)}</p>
      </div>

      <p style="font-size: 14px; color: #888; text-align: center; margin-top: 40px;">
        Dúvidas? Entre em contato pelo nosso WhatsApp ou responda a este e-mail.<br/>
        © ${new Date().getFullYear()} ${escapeHtml(empresa())} - Todos os direitos reservados.
      </p>
    </div>
  `;

  const res = await sendEmail({ to: pedido.customer_email, subject, html });
  return res.success ? { sent: true } : { sent: false, motivo: 'erro ao enviar' };
}