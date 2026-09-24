import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query } from '@/utils/db'
import { verifyPassword } from '@/utils/auth/password'
import { signToken, COOKIE_NAME } from '@/utils/auth/jwt'
import { rateLimit } from '@/utils/rate-limit'

export async function POST(req: Request) {
  try {
    const rl = await rateLimit(req, 'login');
    if (!rl.ok) {
      return NextResponse.json({ error: rl.erro }, { status: 429 });
    }
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    // Buscar usuário
    const { rows } = await query(
      'SELECT id, email, password_hash, full_name FROM public.users WHERE email = $1',
      [email]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
    }

    const user = rows[0]

    // Verificar senha
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
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
    console.error('[Auth/Login] Error:', err.message)
    return NextResponse.json({ error: 'Erro interno ao fazer login' }, { status: 500 })
  }
}
