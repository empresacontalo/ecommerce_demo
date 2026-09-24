import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/auth/server'
import { query } from '@/utils/db'
import { hashPassword } from '@/utils/auth/password'
import { notificarNovoAdmin } from '@/lib/admin-notify'
import { registrarAuditoria } from '@/utils/audit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Helper: exige sessão + admin aprovado */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null
  const { rows: adminCheck } = await query(
    'SELECT status FROM public.admin_users WHERE id = $1',
    [user.id]
  )
  if (!adminCheck[0] || adminCheck[0].status !== 'approved') return null
  return user
}

/**
 * POST — Cria um novo usuário admin (com ou sem senha) e registra em admin_users
 * Body: { email, nome, senha?, status? ('approved'|'pending') }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { email, nome, senha, status } = await req.json()

    if (!email || !EMAIL_RE.test(String(email).trim())) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (!nome || !String(nome).trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if (senha && String(senha).length < 8) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres' }, { status: 400 })
    }

    const finalEmail = String(email).trim().toLowerCase()
    const finalNome = String(nome).trim()
    const novoStatus = status === 'pending' ? 'pending' : 'approved'

    // Email já cadastrado?
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [finalEmail])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 409 })
    }

    // Criar usuário (senha opcional = login por Google; senha informada = email+senha)
    const passwordHash = senha ? await hashPassword(String(senha)) : ''
    const { rows } = await query(
      `INSERT INTO public.users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, full_name, created_at`,
      [finalEmail, passwordHash, finalNome]
    )
    const user = rows[0]

    // Registrar em admin_users
    await query(
      `INSERT INTO public.admin_users (id, email, full_name, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, status = EXCLUDED.status`,
      [user.id, user.email, user.full_name, novoStatus]
    )

    // Notificar por e-mail quando o novo admin já nasce aprovado
    if (novoStatus === 'approved') {
      await notificarNovoAdmin({ email: user.email, nome: user.full_name, temSenha: !!senha }).catch((e) => {
        console.error('[Admin/Users] Falha ao enviar e-mail de boas-vindas:', e)
      })
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'usuario',
      resumo: 'Administrador cadastrado',
      detalhe: `Um novo administrador foi cadastrado com status "${novoStatus === 'approved' ? 'aprovado' : 'aguardando aprovação'}" e recebeu acesso ao painel.`,
    }, req)

    return NextResponse.json({
      success: true,
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      status: novoStatus,
    }, { status: 201 })
  } catch (err: any) {
    console.error('[Admin/Users] POST Error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * GET — Lista todos os admin_users (com filtro opcional)
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let sql = 'SELECT * FROM public.admin_users'
    const params: any[] = []

    if (status && status !== 'all') {
      sql += ' WHERE status = $1'
      params.push(status)
    }

    sql += ' ORDER BY created_at DESC'

    const { rows } = await query(sql, params)

    return NextResponse.json(rows)
  } catch (err: any) {
    console.error('[Admin/Users] GET Error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * PATCH — Atualiza o status de um admin_user
 * Body: { id: string, status: 'approved' | 'blocked' | 'pending' }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id, status } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
    }

    // Estado anterior (para só notificar na transição → approved)
    const antes = await query(
      'SELECT au.status AS st, u.email, u.full_name, u.password_hash FROM public.admin_users au JOIN public.users u ON u.id = au.id WHERE au.id = $1',
      [id]
    )
    if (antes.rows.length === 0) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
    }
    const adminAntes = antes.rows[0]

    const { rowCount } = await query(
      'UPDATE public.admin_users SET status = $1 WHERE id = $2',
      [status, id]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
    }

    // Aprovação: envia e-mail com permissão + método de login
    if (status === 'approved' && adminAntes.st !== 'approved') {
      await notificarNovoAdmin({
        email: adminAntes.email,
        nome: adminAntes.full_name,
        temSenha: !!adminAntes.password_hash,
      }).catch((e: any) => {
        console.error('[Admin/Users] Falha ao enviar e-mail de aprovação:', e)
      })
    }

    const statusRotulo = status === 'approved' ? 'aprovado' : status === 'pending' ? 'aguardando aprovação' : status
    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'usuario',
      resumo: 'Permissão de administrador alterada',
      detalhe: `O acesso ao painel do administrador "${adminAntes.email}" foi alterado para "${statusRotulo}".`,
    }, req)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Admin/Users] PATCH Error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * DELETE — Remove um admin_user
 * Query param: ?id=UUID
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { rowCount } = await query(
      'DELETE FROM public.admin_users WHERE id = $1',
      [id]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
    }

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'usuario',
      resumo: 'Administrador removido',
      detalhe: 'Um administrador foi removido do painel e perdeu o acesso.',
    }, req)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Admin/Users] DELETE Error:', err.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
