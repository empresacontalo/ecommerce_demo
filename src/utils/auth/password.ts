import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Gera hash de uma senha usando bcrypt.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/**
 * Verifica se uma senha em texto plano corresponde ao hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
