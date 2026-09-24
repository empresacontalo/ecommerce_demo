import { NextResponse } from 'next/server'
import { query } from '@/utils/db'
import { hashPassword } from '@/utils/auth/password'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token e nova senha são obrigatórios' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }

    // Buscar usuário com token válido
    const { rows } = await query(
      `SELECT id FROM public.users
       WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
      [token]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 })
    }

    // Atualizar senha e limpar token
    const passwordHash = await hashPassword(password)
    await query(
      `UPDATE public.users
       SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL
       WHERE id = $2`,
      [passwordHash, rows[0].id]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Auth/Update-Password] Error:', err.message)
    return NextResponse.json({ error: 'Erro interno ao atualizar senha' }, { status: 500 })
  }
}
