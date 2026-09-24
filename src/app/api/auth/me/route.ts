import { NextResponse } from 'next/server'
import { getSession } from '@/utils/auth/jwt'
import { query } from '@/utils/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Buscar dados completos do usuário no banco
    const { rows } = await query(
      'SELECT id, email, full_name, avatar_url, created_at, cpf, phone FROM public.users WHERE id = $1',
      [session.sub]
    )

    if (rows.length === 0) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const dbUser = rows[0]
    const fullName = dbUser.full_name || ''
    const fullNameParts = fullName.split(/\s+/)
    const firstName = fullNameParts[0] || ''
    const lastName = fullNameParts.slice(1).join(' ') || ''

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        full_name: dbUser.full_name,
        avatar_url: dbUser.avatar_url,
        created_at: dbUser.created_at,
        cpf: dbUser.cpf || '',
        phone: dbUser.phone || '',
        user_metadata: {
          full_name: fullName,
          name: firstName,
          lastName: lastName,
          cpf: dbUser.cpf || '',
          phone: dbUser.phone || '',
        },
      },
    })
  } catch (err: any) {
    console.error('[Auth/Me] Error:', err.message)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
