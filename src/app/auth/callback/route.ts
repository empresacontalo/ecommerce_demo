import { NextResponse } from 'next/server'

/**
 * Redireciona para o callback do Google OAuth na API de auth.
 * Mantém compatibilidade com a URL antiga /auth/callback
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http'
  const forwardedHost = request.headers.get('x-forwarded-host') || requestUrl.host
  const origin = `${forwardedProto}://${forwardedHost}`

  if (code) {
    // Redirecionar para o novo endpoint de callback com o code
    const state = Buffer.from(next).toString('base64')
    return NextResponse.redirect(`${origin}/api/auth/google/callback?code=${code}&state=${state}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Ocorreu um erro na autenticação`)
}
