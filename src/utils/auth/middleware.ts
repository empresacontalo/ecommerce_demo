import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'portal-auth-token'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not defined')
  }
  return new TextEncoder().encode(secret)
}

async function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { id: payload.sub as string, email: payload.email as string }
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders ?? request.headers },
  })

  const user = await getUserFromRequest(request)

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')

  // 1. Proteger rotas administrativas
  if (isAdminRoute) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('next', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  // 2. Se já estiver logado e tentar acessar login/registro
  if (isAuthRoute && user) {
    // Não redirecionar se estiver em rotas de callback ou recuperação de senha
    const path = request.nextUrl.pathname
    if (path === '/auth/login' || path === '/auth/registro') {
      const next = request.nextUrl.searchParams.get('next') || '/admin'
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'http'
      const forwardedHost = request.headers.get('x-forwarded-host') || request.nextUrl.host
      const url = new URL(next, `${forwardedProto}://${forwardedHost}`)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
