import { sendEmail } from '@/utils/mail';

/**
 * Envia e-mail de boas-vindas/permissão de administrador informando o método
 * de login (e-mail+senha ou Google). Usado na criação e aprovação de admins.
 */
export async function notificarNovoAdmin({ email, nome, temSenha }: { email: string; nome: string; temSenha: boolean }) {
  const empresa = process.env.SMTP_FROM_NAME || 'Fragrance E-commerce Demo';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ecommerce.digitalarea.online';
  const metodo = temSenha ? 'Email & Password' : 'Sign in with Google';
  const passos = temSenha
    ? 'Use the login form with your email and the password assigned by the system administrator.'
    : 'Click the "Sign in with Google" button on the login screen using your authorized email address.';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #16130B; color: #EAE1D4; padding: 40px; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F2CA50; margin: 0;">${empresa}</h1>
        <p style="color: #99907C;">Administrator Portal Access</p>
      </div>

      <h2 style="color: #F2CA50;">Welcome, ${nome}!</h2>
      <p>You have been granted <strong>administrative privileges</strong> on the platform.</p>

      <div style="background: #231F17; border: 1px solid #4D4635; padding: 20px; border-radius: 6px; margin: 25px 0;">
        <h3 style="margin-top: 0; color: #F2CA50;">Access Instructions</h3>
        <p><strong>Authentication Method:</strong> ${metodo}</p>
        <p style="font-size: 14px; color: #D0C5AF;">${passos}</p>
        <p><strong>Portal URL:</strong> <a href="${siteUrl}/admin" style="color: #F2CA50;">${siteUrl}/admin</a></p>
      </div>

      <p style="font-size: 13px; color: #99907C; text-align: center; margin-top: 40px;">
        Questions? Contact system support.<br/>
        &copy; ${new Date().getFullYear()} ${empresa}. All rights reserved.
      </p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Administrator Access Granted - ${empresa}`,
    html,
  });
}