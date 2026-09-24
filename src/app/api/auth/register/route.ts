import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query } from '@/utils/db'
import { hashPassword } from '@/utils/auth/password'
import { signToken, COOKIE_NAME } from '@/utils/auth/jwt'
import { validarCpf } from '@/utils/cpf'

export async function POST(req: Request) {
  try {
    const { email, password, name, cpf, phone, is_admin_request } = await req.json()

    // Validação
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }

    // Se o CPF foi informado no cadastro, valida antes de criar a conta
    let cpfLimpo: string | null = null
    if (cpf && String(cpf).trim()) {
      cpfLimpo = String(cpf).replace(/\D/g, '')
      if (!validarCpf(cpfLimpo)) {
        return NextResponse.json({ error: 'CPF inválido. Verifique os números.' }, { status: 400 })
      }
    }

    // Verificar se email já existe
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 409 })
    }

    // Criar usuário
    const passwordHash = await hashPassword(password)
    const fullName = name || email.split('@')[0]

    const { rows } = await query(
      `INSERT INTO public.users (email, password_hash, full_name, cpf, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, created_at`,
      [email, passwordHash, fullName, cpfLimpo, phone?.trim() || null]
    )

    const user = rows[0]

    // Se for solicitação de admin, criar registro em admin_users
    if (is_admin_request) {
      await query(
        `INSERT INTO public.admin_users (id, email, full_name, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email, user.full_name]
      )
    }

    // Gerar JWT e setar cookie
    const token = await signToken({ sub: user.id, email: user.email })
    const cookieStore = await cookies()

    // secure:false pois o Nginx Proxy Manager faz SSL termination
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: parseInt(process.env.JWT_EXPIRY || '3600'),
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name },
    })
  } catch (err: any) {
    console.error('[Auth/Register] Error:', err.message)
    return NextResponse.json({ error: 'Erro interno ao criar conta' }, { status: 500 })
  }
}
