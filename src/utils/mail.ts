import nodemailer from 'nodemailer';
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailProps {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailProps) {
  try {
    const fromName = process.env.SMTP_FROM_NAME || EMPRESA_NOME_PADRAO;
    const info = await transporter.sendMail({
      from: fromName ? `"${fromName}" <${process.env.SMTP_USER}>` : process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log('[Mail] Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mail] Error sending email:', error);
    return { success: false, error };
  }
}
