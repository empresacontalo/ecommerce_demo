import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/auth/middleware'
import { COOKIE_NAME, verifyToken } from './utils/auth/jwt'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const READONLY_BLOCKED_GET_PATTERNS = [
  /^\/api\/admin\/backups\/[^/]+\/download/,
  /^\/api\/admin\/mcp-tokens\/copy/,
  /^\/api\/admin\/agente/,
]

function isReadOnlyDemoAccount(email?: string | null, role?: string | null): boolean {
  if (role === 'readonly') return true
  if (!email) return false
  const configured = (process.env.DEMO_READONLY_EMAIL || 'demo@aurafragrances.demo').trim().toLowerCase()
  return email.trim().toLowerCase() === configured
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Hard server-side read-only enforcement for demo viewer on admin & CMS APIs
  if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/cms/')) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (token) {
      const session = await verifyToken(token)
      if (session && isReadOnlyDemoAccount(session.email, session.role)) {
        if (WRITE_METHODS.has(request.method)) {
          return NextResponse.json(
            { error: 'Read-only demo account: modifications are disabled.' },
            { status: 403 }
          )
        }
        if (READONLY_BLOCKED_GET_PATTERNS.some((re) => re.test(pathname))) {
          return NextResponse.json(
            { error: 'Sensitive resource is restricted in read-only demo mode.' },
            { status: 403 }
          )
        }
      }
    }
    return NextResponse.next()
  }

  // Redirect 301 da URL antiga do catálogo (cabelos-e-acessorios → catalogo)
  // para não quebrar links antigos/indexação.
  if (pathname.startsWith('/cabelos-e-acessorios')) {
    const novaUrl = request.nextUrl.clone()
    novaUrl.pathname = novaUrl.pathname.replace(/^\/cabelos-e-acessorios/, '/catalogo')
    return NextResponse.redirect(novaUrl, 301)
  }

  // Expõe o pathname para o layout raiz escolher as Google TAGS (Tráfego Pago)
  // que devem ser inseridas no <head> desta página.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  return await updateSession(request, requestHeaders)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static assets and public non-admin APIs.
     * Admin & CMS APIs are matched specifically for read-only demo enforcement.
     */
    '/api/admin/:path*',
    '/api/cms/:path*',
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
