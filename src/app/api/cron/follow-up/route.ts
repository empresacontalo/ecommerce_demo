import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { normalizarWhatsApp } from '@/utils/campanhas';
import { gerarMensagemIA } from '@/utils/campanhas-ia';

// GET /api/cron/follow-up?secret=... — Follow-up automático por IA
// Para cada lead com status='enviada' cuja última comunicação passou do
// período configurável (follow_up_horas da campanha), marca como
// 'sem_resposta' e envia nova mensagem de follow-up gerada por IA.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const vencidos = await query(
      `SELECT l.id, l.nome, l.whatsapp, l.email, l.canal_preferido, l.status_comunicacao,
              c.titulo AS campanha_titulo, c.desconto, c.follow_up_horas,
              (SELECT MAX(criado_em) FROM public.campanha_contatos cc WHERE cc.lead_id = l.id) AS ultimo_contato
       FROM public.campanha_leads l
       JOIN public.campanhas c ON c.id = l.campanha_id
       WHERE l.status_comunicacao = 'enviada'
         AND (SELECT MAX(criado_em) FROM public.campanha_contatos cc WHERE cc.lead_id = l.id)
             < NOW() - (c.follow_up_horas || ' hours')::interval
       FOR UPDATE SKIP LOCKED`
    );

    const resultados: string[] = [];
    for (const lead of vencidos.rows) {
      let mensagem: string;
      try {
        mensagem = await gerarMensagemIA({
          nome: lead.nome,
          campanhaTitulo: lead.campanha_titulo,
          desconto: lead.desconto,
          tipo: 'followup',
        });
      } catch {
        mensagem = `Olá, ${lead.nome}! Não queremos perder você. A ${lead.campanha_titulo || 'promoção'} continua valendo — quer confirmar seu interesse?`;
      }

      const canal = lead.canal_preferido || 'whatsapp';
      let status = 'enviada';
      let resultado: string | null = null;

      if (canal === 'whatsapp') {
        const wa = normalizarWhatsApp(lead.whatsapp) || '';
        if (!wa) status = 'erro';
        else resultado = `https://wa.me/${wa}?text=${encodeURIComponent(mensagem)}`;
      } else if (canal === 'email') {
        const nodemailer = await import('nodemailer');
        try {
          const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME } = process.env;
          if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('SMTP não configurado');
          const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT || 587),
            secure: Number(SMTP_PORT || 587) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          });
          await transporter.sendMail({
            from: `"${SMTP_FROM_NAME || process.env.EMPRESA_NOME || 'Contato'}" <${SMTP_USER}>`,
            to: lead.email,
            subject: `${lead.campanha_titulo || 'Promoção'}`,
            text: mensagem,
          });
          resultado = lead.email;
        } catch (err) {
          console.error('[cron/follow-up] email erro:', err);
          status = 'erro';
        }
      } else {
        status = 'erro';
        resultado = 'follow-up automático indisponível para chat';
      }

      await query(
        `INSERT INTO public.campanha_contatos (lead_id, canal, tipo, mensagem, status, resultado)
         VALUES ($1, $2, 'followup', $3, $4, $5)`,
        [lead.id, canal, mensagem, status, resultado]
      );

      // Só marca como sem_resposta quando o envio teve sucesso; em erro,
      // mantém 'enviada' para que o próximo ciclo tente novamente (retry).
      if (status === 'enviada') {
        await query(
          `UPDATE public.campanha_leads SET status_comunicacao = 'sem_resposta' WHERE id = $1`,
          [lead.id]
        );
      }
      resultados.push(`${lead.id}:${status}`);
    }

    return NextResponse.json({ processados: vencidos.rows.length, resultados });
  } catch (err) {
    console.error('[cron/follow-up] erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
