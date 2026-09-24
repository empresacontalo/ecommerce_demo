import { NextRequest, NextResponse } from 'next/server';
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN } from '@/utils/chatwoot-config';
import { query } from '@/utils/db';
import { normalizarWhatsApp } from '@/utils/campanhas';
import { getAdminSession } from '@/utils/auth/admin';
import { gerarMensagemIA } from '@/utils/campanhas-ia';

type Ctx = { params: Promise<{ id: string }> };

async function enviarPorCanal(lead: any, mensagem: string, campanha: any): Promise<{ canal: string; status: string; resultado?: string }> {
  const canal = lead.canal_preferido || 'whatsapp';
  if (canal === 'whatsapp') {
    const texto = encodeURIComponent(mensagem);
    const wa = normalizarWhatsApp(lead.whatsapp) || '';
    return {
      canal,
      status: wa ? 'enviada' : 'erro',
      resultado: wa ? `https://wa.me/${wa}?text=${texto}` : 'whatsapp ausente',
    };
  }
  if (canal === 'email') {
    const email = lead.email || '';
    if (!email) return { canal, status: 'erro', resultado: 'email ausente' };
    try {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return { canal, status: 'erro', resultado: 'SMTP não configurado' };
      }
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 587),
        secure: Number(SMTP_PORT || 587) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"${SMTP_FROM_NAME || process.env.EMPRESA_NOME || 'Contato'}" <${SMTP_USER}>`,
        to: email,
        subject: `${campanha?.titulo || 'Promoção'}`,
        text: mensagem,
      });
      return { canal, status: 'enviada', resultado: email };
    } catch (err) {
      console.error('[Campanhas/email] erro:', err);
      return { canal, status: 'erro', resultado: 'falha no envio' };
    }
  }
  if (canal === 'chat') {
    const { urlCfg, tokenCfg } = await import('@/app/actions/cms').then(async (m) => {
      const [a, b] = await Promise.all([m.getConfiguracao('chatwoot.url'), m.getConfiguracao('chatwoot.token')]);
      return { urlCfg: a, tokenCfg: b };
    });
    const baseUrl = ((urlCfg?.valor as string) || CHATWOOT_BASE_URL).replace(/\/$/, '');
    const websiteToken = (tokenCfg?.valor as string) || process.env.CHATWOOT_API_TOKEN || CHATWOOT_WEBSITE_TOKEN;
    if (!websiteToken) return { canal, status: 'erro', resultado: 'chat não configurado' };
    try {
      const widgetRes = await fetch(`${baseUrl}/widget?website_token=${websiteToken}`, { headers: { Accept: 'text/html' } });
      const widgetHtml = await widgetRes.text();
      const authMatch = widgetHtml.match(/window\.authToken\s*=\s*'([^']+)'/);
      const authToken = authMatch?.[1];
      if (!authToken) return { canal, status: 'erro', resultado: 'token do chat não obtido' };
      const convRes = await fetch(`${baseUrl}/api/v1/widget/conversations?website_token=${websiteToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
        body: JSON.stringify({
          contact: { name: lead.nome || 'Visitante' },
          message: {
            content: mensagem,
            timestamp: new Date().toString(),
            referer_url: lead.whatsapp ? `whatsapp:${lead.whatsapp}` : undefined,
          },
        }),
      });
      return { canal, status: convRes.ok ? 'enviada' : 'erro', resultado: `conversa ${convRes.status}` };
    } catch (err) {
      console.error('[Campanhas/chat] erro:', err);
      return { canal, status: 'erro', resultado: 'falha no chat' };
    }
  }
  return { canal, status: 'erro', resultado: 'canal desconhecido' };
}

// POST /api/cms/campanhas/[id]/followup — Follow-up manual (admin)
export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { lead_id, mensagem } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 });

    const leadRes = await query(
      `SELECT l.*, c.titulo AS campanha_titulo, c.desconto
       FROM public.campanha_leads l
       JOIN public.campanhas c ON c.id = l.campanha_id
       WHERE l.id = $1 AND l.campanha_id = $2`,
      [lead_id, id]
    );
    if (leadRes.rows.length === 0) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    const lead = leadRes.rows[0];

    let texto = mensagem;
    if (!texto) {
      try {
        texto = await gerarMensagemIA({
          nome: lead.nome,
          whatsapp: lead.whatsapp,
          email: lead.email,
          campanhaTitulo: lead.campanha_titulo,
          desconto: lead.desconto,
          tipo: 'followup',
        });
      } catch (err) {
        console.error('[Campanhas/followup] IA erro:', err);
        texto = `Olá, ${lead.nome}! Não queremos perder você. A ${lead.campanha_titulo || 'promoção'} continua valendo — quer confirmar seu interesse?`;
      }
    }

    const envio = await enviarPorCanal(lead, texto, lead);
    await query(
      `INSERT INTO public.campanha_contatos (lead_id, canal, tipo, mensagem, status, resultado)
       VALUES ($1, $2, 'manual', $3, $4, $5)`,
      [lead_id, envio.canal, texto, envio.status, envio.resultado || null]
    );
    if (envio.status === 'enviada') {
      await query(
        `UPDATE public.campanha_leads SET status_comunicacao = 'enviada', mensagem = $2 WHERE id = $1`,
        [lead_id, texto]
      );
    }

    return NextResponse.json({ success: true, envio, mensagem: texto });
  } catch (err) {
    console.error('[Campanhas/followup] erro:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
