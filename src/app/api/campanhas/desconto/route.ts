import { NextRequest, NextResponse } from 'next/server';
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN } from '@/utils/chatwoot-config';
import { query } from '@/utils/db';
import { normalizarWhatsApp } from '@/utils/campanhas';
import { gerarMensagemIA } from '@/utils/campanhas-ia';
import { rateLimit } from '@/utils/rate-limit';

interface LeadRow {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  canal_preferido: string;
  campanha_titulo: string;
  desconto: string | null;
  mensagem_prompt: string | null;
}

interface EnvioResult {
  canal: string;
  status: string;
  resultado?: string;
  authToken?: string | null;
}

async function enviarPorCanal(lead: LeadRow, mensagem: string, campanha: { titulo?: string }): Promise<EnvioResult> {
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
      console.error('[Campanhas/desconto] email erro:', err);
      return { canal, status: 'erro', resultado: 'falha no envio' };
    }
  }
  if (canal === 'chat') {
    const { getConfiguracao } = await import('@/app/actions/cms');
    const [urlCfg, tokenCfg] = await Promise.all([
      getConfiguracao('chatwoot.url'),
      getConfiguracao('chatwoot.token'),
    ]);
    const baseUrl = ((urlCfg?.valor as string) || CHATWOOT_BASE_URL).replace(/\/$/, '');
    const websiteToken = (tokenCfg?.valor as string) || process.env.CHATWOOT_API_TOKEN || CHATWOOT_WEBSITE_TOKEN;
    if (!websiteToken) return { canal, status: 'erro', resultado: 'chat não configurado' };
    try {
      const widgetRes = await fetch(`${baseUrl}/widget?website_token=${websiteToken}`, { headers: { Accept: 'text/html' } });
      const widgetHtml = await widgetRes.text();
      const authMatch = widgetHtml.match(/window\.authToken\s*=\s*'([^']+)'/);
      const authToken = authMatch?.[1] || null;
      if (!authToken) return { canal, status: 'erro', resultado: 'token do chat não obtido' };
      const convRes = await fetch(`${baseUrl}/api/v1/widget/conversations?website_token=${websiteToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
        body: JSON.stringify({
          contact: { name: lead.nome || 'Visitante' },
          message: { content: mensagem, timestamp: new Date().toString(), referer_url: '' },
        }),
      });
      if (!convRes.ok) return { canal, status: 'erro', resultado: `conversa ${convRes.status}` };
      return { canal, status: 'enviada', authToken };
    } catch (err) {
      console.error('[Campanhas/desconto] chat erro:', err);
      return { canal, status: 'erro', resultado: 'falha no chat' };
    }
  }
  return { canal, status: 'erro', resultado: 'canal desconhecido' };
}

// POST /api/campanhas/desconto — CTA "Quero receber meu desconto sem compromisso"
// 1. Valida/recupera o lead  2. Gera mensagem personalizada por IA
// 3. Envia pelo canal preferido (WhatsApp padrão)  4. Registra contato e status
export async function POST(req: Request) {
  try {
    const rl = await rateLimit(req, 'desconto');
    if (!rl.ok) {
      return NextResponse.json({ error: rl.erro }, { status: 429 });
    }

    const { lead_id, canal } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 });

    const leadRes = await query(
      `SELECT l.*, c.titulo AS campanha_titulo, c.desconto, c.mensagem_prompt
       FROM public.campanha_leads l
       JOIN public.campanhas c ON c.id = l.campanha_id
       WHERE l.id = $1`,
      [lead_id]
    );
    if (leadRes.rows.length === 0) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    const lead = leadRes.rows[0];

    const canalFinal = canal && ['whatsapp', 'chat', 'email'].includes(canal) ? canal : lead.canal_preferido || 'whatsapp';
    if (canalFinal !== lead.canal_preferido) {
      await query(`UPDATE public.campanha_leads SET canal_preferido = $2 WHERE id = $1`, [lead_id, canalFinal]);
      lead.canal_preferido = canalFinal;
    }

    let mensagem = '';
    try {
      mensagem = await gerarMensagemIA({
        nome: lead.nome,
        campanhaTitulo: lead.campanha_titulo,
        desconto: lead.desconto,
        mensagemPrompt: lead.mensagem_prompt,
      });
    } catch (err) {
      console.error('[Campanhas/desconto] IA erro:', err);
      mensagem = `Olá, ${lead.nome}! Aproveite a ${lead.campanha_titulo || 'promoção'}${lead.desconto ? ` com ${lead.desconto} de desconto` : ''}. Confirma seu interesse?`;
    }

    const envio = await enviarPorCanal(lead, mensagem, lead);
    await query(
      `INSERT INTO public.campanha_contatos (lead_id, canal, tipo, mensagem, status, resultado)
       VALUES ($1, $2, 'inicial', $3, $4, $5)`,
      [lead_id, envio.canal, mensagem, envio.status, envio.resultado || null]
    );
    await query(
      `UPDATE public.campanha_leads
       SET status_comunicacao = CASE WHEN $2 = 'enviada' THEN 'enviada' ELSE 'pendente' END,
           mensagem = $3
       WHERE id = $1`,
      [lead_id, envio.status, mensagem]
    );

    return NextResponse.json({
      success: envio.status === 'enviada',
      canal: envio.canal,
      mensagem,
      acao: envio.resultado || null,
      authToken: envio.authToken ?? null,
    });
  } catch (err) {
    console.error('Erro no CTA de desconto:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
