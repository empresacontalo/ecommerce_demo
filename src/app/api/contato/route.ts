import { NextResponse } from 'next/server';
import { sendEmail } from '@/utils/mail';
import { getConfiguracao } from '@/app/actions/cms';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';
import { rateLimit } from '@/utils/rate-limit';

export async function POST(request: Request) {
  try {
    const rl = await rateLimit(request, 'contato');
    if (!rl.ok) {
      return NextResponse.json({ error: rl.erro }, { status: 429 });
    }
    const body = await request.json();
    const { name, email, phone, subject, message } = body;
    const logo = await getConfiguracao('header.logo');
    const empresa = logo?.texto || EMPRESA_NOME_PADRAO;

    // Validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Nome, E-mail e Mensagem são obrigatórios.' },
        { status: 400 }
      );
    }

    const adminEmail = process.env.SMTP_USER || '';
    
    // Construct email content
    const emailSubject = `[Fale Conosco] Assunto: ${subject || 'Sem Assunto'} - De: ${name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
        <h2 style="color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px; margin-top: 0;">Nova Mensagem de Contato</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">Nome:</td>
            <td style="padding: 8px 0;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">E-mail:</td>
            <td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Telefone:</td>
            <td style="padding: 8px 0;">${phone || 'Não informado'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Assunto:</td>
            <td style="padding: 8px 0;">${subject || 'Não especificado'}</td>
          </tr>
        </table>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #d4af37;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #555;">Mensagem:</h4>
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        <p style="font-size: 0.8rem; color: #888; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
          Esta mensagem foi enviada a partir do formulário Fale Conosco da ${empresa}.
        </p>
      </div>
    `;

    const mailResult = await sendEmail({
      to: adminEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    if (!mailResult.success) {
      console.error('SMTP error sending contact email:', mailResult.error);
      return NextResponse.json(
        { error: 'Ocorreu um erro no servidor de e-mail ao tentar enviar sua mensagem.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: mailResult.messageId });
  } catch (err: any) {
    console.error('Erro inesperado em POST /api/contato:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
