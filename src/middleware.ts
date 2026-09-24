import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/auth/middleware'

export default async function middleware(request: NextRequest) {
  // Redirect 301 da URL antiga do catálogo (cabelos-e-acessorios → catalogo)
  // para não quebrar links antigos/indexação.
  if (request.nextUrl.pathname.startsWith('/cabelos-e-acessorios')) {
    const novaUrl = request.nextUrl.clone()
    novaUrl.pathname = novaUrl.pathname.replace(/^\/cabelos-e-acessorios/, '/catalogo')
    return NextResponse.redirect(novaUrl, 301)
  }

  // Expõe o pathname para o layout raiz escolher as Google TAGS (Tráfego Pago)
  // que devem ser inseridas no <head> desta página.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  return await updateSession(request, requestHeaders)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets (svg, png, jpg, etc.)
     * - API routes (handled independently with service role)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
