import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/cms/campanhas/[id]/leads — Leads capturados da campanha + contatos
export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const leads = await query(
      `SELECT * FROM public.campanha_leads WHERE campanha_id = $1 ORDER BY criado_em DESC LIMIT 500`,
      [id]
    );
    const contatos = await query(
      `SELECT * FROM public.campanha_contatos
       WHERE lead_id IN (SELECT id FROM public.campanha_leads WHERE campanha_id = $1)
       ORDER BY criado_em DESC LIMIT 1000`,
      [id]
    );
    return NextResponse.json({ leads: leads.rows, contatos: contatos.rows });
  } catch (err) {
    console.error('Erro ao listar leads:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
