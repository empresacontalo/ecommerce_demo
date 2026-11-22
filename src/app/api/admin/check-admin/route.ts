import { createClient } from '@/utils/auth/server'
import { query } from '@/utils/db'
import { isReadOnlyEmail } from '@/utils/auth/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ isAdmin: false, reason: 'not_authenticated', details: authError }, { status: 401 })
    }

    // Usa o pool compartilhado (src/utils/db.ts)
    const { rows } = await query(
      'SELECT status FROM public.admin_users WHERE id = $1',
      [user.id]
    )

    const adminData = rows[0]
    if (!adminData || adminData.status !== 'approved') {
      return NextResponse.json({ isAdmin: false, reason: 'not_approved' })
    }

    return NextResponse.json({
      isAdmin: true,
      readOnly: isReadOnlyEmail(user.email),
      userId: user.id,
      email: user.email,
    })
  } catch (err: any) {
    console.error('[check-admin] Unexpected error:', err.message)
    return NextResponse.json({ isAdmin: false, reason: 'error', message: err.message }, { status: 500 })
  }
}
