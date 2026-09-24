import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'portal-auth-token'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not defined')
  }
  return new TextEncoder().encode(secret)
}

function getExpiry(): string {
  const expiry = process.env.JWT_EXPIRY || '3600'
  return `${expiry}s`
}

export interface JWTPayload {
  sub: string // user id
  email: string
  role?: string
}

/**
 * Assina um JWT com o payload fornecido.
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(getExpiry())
    .sign(getSecret())
}

/**
 * Verifica e decodifica um JWT.
 * Retorna o payload ou null se inválido/expirado.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

/**
 * Extrai o token JWT dos cookies e verifica.
 * Retorna o payload ou null se não autenticado.
 */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export { COOKIE_NAME }
