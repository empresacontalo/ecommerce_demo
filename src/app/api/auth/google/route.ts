import { NextResponse } from 'next/server'

/**
 * Inicia o fluxo de login com Google OAuth.
 * Redireciona para a página de consentimento do Google.
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url)
  const next = requestUrl.searchParams.get('next') || '/'
  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!clientId) {
    // Determinar origem respeitando proxy reverso
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'http'
    const forwardedHost = req.headers.get('x-forwarded-host') || requestUrl.host
    const origin = `${forwardedProto}://${forwardedHost}`
    return NextResponse.redirect(`${origin}/auth/login?error=Google OAuth não configurado`)
  }

  // Determinar origem para o redirect_uri
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'http'
  const forwardedHost = req.headers.get('x-forwarded-host') || requestUrl.host
  const origin = `${forwardedProto}://${forwardedHost}`
  const redirectUri = `${origin}/api/auth/google/callback`

  // Codificar o next URL no state para recuperar após callback
  const state = Buffer.from(next).toString('base64')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
