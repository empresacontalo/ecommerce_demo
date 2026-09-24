import { NextResponse } from 'next/server'
import { query } from '@/utils/db'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getConfiguracao } from '@/app/actions/cms'
import { EMPRESA_NOME_PADRAO } from '@/utils/empresa-default'

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })
    }

    // Verificar se usuário existe
    const { rows } = await query('SELECT id, email, full_name FROM public.users WHERE email = $1', [email])

    // Sempre retornar sucesso, mesmo se email não existir (evita enumeração)
    if (rows.length === 0) {
      return NextResponse.json({ success: true })
    }

    // Gerar token de reset (32 bytes hex = 64 caracteres)
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await query(
      'UPDATE public.users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetExpiry.toISOString(), rows[0].id]
    )

    // Enviar email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const resetUrl = `${siteUrl}/auth/atualizar-senha?token=${resetToken}`
    const logo = await getConfiguracao('header.logo')
    const empresa = logo?.texto || EMPRESA_NOME_PADRAO

    try {
      const transporter = getTransporter()
      await transporter.sendMail({
        from: empresa ? `"${empresa}" <${process.env.SMTP_USER}>` : process.env.SMTP_USER,
        to: email,
        subject: empresa ? `Recuperação de Senha - ${empresa}` : 'Recuperação de Senha',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${empresa ? `<h2 style="color: #d4a853;">${empresa}</h2>` : ''}
            <p>Olá${rows[0].full_name ? ' ' + rows[0].full_name.split(' ')[0] : ''},</p>
            <p>Recebemos uma solicitação de recuperação de senha para sua conta.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #d4a853; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
              Redefinir Senha
            </a>
            <p style="color: #666; font-size: 14px;">Este link expira em 1 hora.</p>
            <p style="color: #666; font-size: 14px;">Se você não solicitou esta alteração, ignore este email.</p>
          </div>
        `,
      })
    } catch (emailErr: any) {
      console.error('[Auth/Reset-Password] Email send failed:', emailErr.message)
      // Não falhar a request — o token foi salvo, o usuário pode tentar novamente
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Auth/Reset-Password] Error:', err.message)
    return NextResponse.json({ error: 'Erro interno ao processar solicitação' }, { status: 500 })
  }
}
