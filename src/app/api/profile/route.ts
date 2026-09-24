import { NextResponse } from 'next/server'
import { getSession } from '@/utils/auth/jwt'
import { query } from '@/utils/db'
import { validarCpf } from '@/utils/cpf'

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { name, lastName, phone, cpf } = await req.json()

    if (!name?.trim() || !lastName?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    const fullName = `${name.trim()} ${lastName.trim()}`

    // Busca o CPF atual do usuário no banco (nunca confiar no valor do cliente)
    const { rows } = await query('SELECT cpf FROM public.users WHERE id = $1', [session.sub])
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }
    const cpfAtual = rows[0].cpf as string | null

    // Regra: CPF é editável somente enquanto não foi cadastrado.
    // Após o primeiro cadastro, torna-se imutável.
    if (cpfAtual && cpf && cpfAtual.replace(/\D/g, '') !== String(cpf).replace(/\D/g, '')) {
      return NextResponse.json(
        { error: 'O CPF já foi cadastrado e não pode ser alterado.' },
        { status: 400 }
      )
    }

    // Se está cadastrando o CPF pela primeira vez, valida antes de salvar
    let cpfFinal: string | null = cpfAtual
    if (!cpfAtual && cpf && String(cpf).trim()) {
      const cpfLimpo = String(cpf).replace(/\D/g, '')
      if (!validarCpf(cpfLimpo)) {
        return NextResponse.json({ error: 'CPF inválido. Verifique os números.' }, { status: 400 })
      }
      cpfFinal = cpfLimpo
    }

    const { rowCount } = await query(
      `UPDATE public.users
       SET full_name = $1, phone = $2, cpf = $3, updated_at = NOW()
       WHERE id = $4`,
      [fullName, phone.trim(), cpfFinal, session.sub]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro inesperado ao atualizar perfil.'
    console.error('[Profile] Update error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
