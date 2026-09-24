import { NextResponse } from 'next/server'
import { query } from '@/utils/db'
import { signToken, COOKIE_NAME } from '@/utils/auth/jwt'
import { cookies } from 'next/headers'

/**
 * Callback do Google OAuth.
 * Troca o authorization code por tokens, busca/cria usuário,
 * gera JWT e redireciona.
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')

  // Recuperar o next URL do state (codificado em base64)
  let next = '/'
  if (state) {
    try {
      const decoded = Buffer.from(state, 'base64').toString('utf-8')
      if (decoded.startsWith('/')) next = decoded
    } catch { /* ignora state inválido */ }
  }

  // Determinar origem respeitando proxy reverso
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'http'
  const forwardedHost = req.headers.get('x-forwarded-host') || requestUrl.host
  const origin = `${forwardedProto}://${forwardedHost}`

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=Autenticação cancelada`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_SECRET
  const redirectUri = `${origin}/api/auth/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/auth/login?error=Configuração Google OAuth ausente`)
  }

  try {
    // 1. Trocar code por tokens no Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      console.error('[Auth/Google] Token error:', tokenData.error_description)
      return NextResponse.redirect(`${origin}/auth/login?error=Falha na autenticação Google`)
    }

    // 2. Buscar informações do usuário no Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const googleUser = await userRes.json()

    if (!googleUser.email) {
      return NextResponse.redirect(`${origin}/auth/login?error=Não foi possível obter email do Google`)
    }

    // 3. Buscar ou criar usuário local
    let userId: string
    const existingByGoogle = await query(
      'SELECT id FROM public.users WHERE google_id = $1',
      [googleUser.id]
    )

    if (existingByGoogle.rows.length > 0) {
      userId = existingByGoogle.rows[0].id
    } else {
      const existingByEmail = await query(
        'SELECT id FROM public.users WHERE email = $1',
        [googleUser.email]
      )

      if (existingByEmail.rows.length > 0) {
        // Vincular Google ID ao usuário existente
        userId = existingByEmail.rows[0].id
        await query(
          'UPDATE public.users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
          [googleUser.id, googleUser.picture, userId]
        )
      } else {
        // Criar novo usuário
        const { rows } = await query(
          `INSERT INTO public.users (email, password_hash, full_name, google_id, avatar_url)
           VALUES ($1, '', $2, $3, $4)
           RETURNING id`,
          [googleUser.email, googleUser.name || googleUser.email.split('@')[0], googleUser.id, googleUser.picture]
        )
        userId = rows[0].id
      }
    }

    // 4. Gerar JWT e setar cookie
    const token = await signToken({ sub: userId, email: googleUser.email })
    const cookieStore = await cookies()

    // secure:false pois o Nginx Proxy Manager faz SSL termination
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: parseInt(process.env.JWT_EXPIRY || '3600'),
    })

    return NextResponse.redirect(`${origin}${next}`)
  } catch (err: any) {
    console.error('[Auth/Google] Callback error:', err.message)
    return NextResponse.redirect(`${origin}/auth/login?error=Erro interno na autenticação`)
  }
}
