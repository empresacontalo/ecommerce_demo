import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { query } from '@/utils/db';
import { purgarAuditLogs } from '@/utils/audit';

export const dynamic = 'force-dynamic';

const POR_PAGINA_VALIDOS = [10, 25, 50, 100] as const;

// GET /api/admin/audit-logs — Lista logs de auditoria com filtros e paginação.
// Filtros: responsavel, tipo (admin|mcp), acao, q (busca em resumo/detalhe/ip/responsável),
// de, ate (datas ISO). Paginação: pagina + por_pagina (10/25/50/100).
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    // Purga logs expirados (retenção 7 dias) — lazy, além do cron diário
    await purgarAuditLogs();

    const { searchParams } = new URL(req.url);
    const responsavel = searchParams.get('responsavel')?.trim() || '';
    const tipo = searchParams.get('tipo')?.trim() || '';
    const acao = searchParams.get('acao')?.trim() || '';
    const q = searchParams.get('q')?.trim() || '';
    const de = searchParams.get('de')?.trim() || '';
    const ate = searchParams.get('ate')?.trim() || '';
    const pagina = Math.max(1, parseInt(searchParams.get('pagina') || '1', 10) || 1);
    const porPaginaRaw = parseInt(searchParams.get('por_pagina') || '25', 10);
    const porPagina = (POR_PAGINA_VALIDOS as readonly number[]).includes(porPaginaRaw)
      ? porPaginaRaw
      : 25;

    const conds: string[] = [];
    const params: unknown[] = [];

    if (tipo === 'admin' || tipo === 'mcp') {
      params.push(tipo);
      conds.push(`responsavel_tipo = $${params.length}`);
    }
    if (responsavel) {
      params.push(`%${responsavel}%`);
      conds.push(`responsavel_nome ILIKE $${params.length}`);
    }
    if (acao) {
      params.push(acao);
      conds.push(`acao = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conds.push(
        `(resumo ILIKE $${params.length} OR detalhe ILIKE $${params.length} OR ip ILIKE $${params.length} OR localizacao ILIKE $${params.length})`,
      );
    }
    if (de) {
      params.push(de);
      conds.push(`criado_em >= $${params.length}::timestamptz`);
    }
    if (ate) {
      params.push(ate);
      conds.push(`criado_em < ($${params.length}::timestamptz + INTERVAL '1 day')`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [{ rows: totalRows }, { rows }] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM public.audit_logs ${where}`, params),
      query(
        `SELECT id, responsavel_tipo, responsavel_nome, acao, resumo, detalhe,
                ip, navegador, sistema_operacional, localizacao, criado_em
         FROM public.audit_logs
         ${where}
         ORDER BY criado_em DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, porPagina, (pagina - 1) * porPagina],
      ),
    ]);

    const total = Number(totalRows[0]?.total || 0);

    // Opções de filtro (para os selects da tela)
    const [{ rows: acoes }, { rows: responsaveis }] = await Promise.all([
      query('SELECT DISTINCT acao FROM public.audit_logs ORDER BY acao'),
      query('SELECT DISTINCT responsavel_nome FROM public.audit_logs ORDER BY responsavel_nome LIMIT 500'),
    ]);

    return NextResponse.json({
      itens: rows,
      total,
      pagina,
      por_pagina: porPagina,
      total_paginas: Math.max(1, Math.ceil(total / porPagina)),
      filtros: {
        acoes: acoes.map((r) => r.acao),
        responsaveis: responsaveis.map((r) => r.responsavel_nome),
      },
    });
  } catch (err) {
    console.error('[audit-logs] GET:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}