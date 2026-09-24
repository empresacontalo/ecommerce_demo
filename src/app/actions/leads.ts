'use server';

import { createClient } from '@/utils/auth/server';
import { query } from '@/utils/db';
import { sendEmail } from '@/utils/mail';
import { getConfiguracao } from '@/app/actions/cms';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

export async function registerLead(name: string, phone: string, email: string | null) {
  try {
    const supabase = await createClient();
    const logo = await getConfiguracao('header.logo');
    const empresa = logo?.texto || EMPRESA_NOME_PADRAO;

    // Insert lead into public.leads table
    const { rows } = await query(
      `INSERT INTO public.leads (name, phone, email, source, status, score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, phone, email || null, 'Formulário Home', 'Novo', 50]
    );

    // Try to send email notification (don't fail the lead creation if email sending fails)
    try {
      const adminEmail = process.env.SMTP_USER || '';
      const emailSubject = `[Novo Lead] Desconto Reclamado - ${name}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
          <h2 style="color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px; margin-top: 0;">Novo Lead Cadastrado (Promoção)</h2>
          <p>Um usuário se cadastrou no site para obter o cupom de desconto.</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 120px;">Nome:</td>
              <td style="padding: 8px 0;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">WhatsApp:</td>
              <td style="padding: 8px 0;"><a href="https://wa.me/${phone.replace(/\D/g, '')}">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">E-mail:</td>
              <td style="padding: 8px 0;">${email ? `<a href="mailto:${email}">${email}</a>` : 'Não informado'}</td>
            </tr>
          </table>
          <p style="font-size: 0.8rem; color: #888; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
            ${empresa} — Leads Management System.
          </p>
        </div>
      `;

      await sendEmail({
        to: adminEmail,
        subject: emailSubject,
        html: emailHtml,
      });
    } catch (mailErr) {
      console.error('[Action registerLead] Failed to send notification email:', mailErr);
    }

    return { success: true, data: rows[0] };
  } catch (err: any) {
    console.error('[Action registerLead] Error:', err);
    return { success: false, error: err.message || 'Erro ao registrar lead.' };
  }
}
