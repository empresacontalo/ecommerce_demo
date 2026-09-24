import { NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

// GET /api/admin/dashboard — Estatísticas reais do painel
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const [vendasMes, pedidos, clientes, pedidosRecentes, leadsNovos, agendamentosHoje] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_price), 0) AS total
             FROM public.orders
             WHERE status IN ('APROVADO', 'EM_PREPARACAO', 'ENVIADO')
               AND created_at >= date_trunc('month', CURRENT_DATE)`),
      query(`SELECT COUNT(*) AS total FROM public.orders`),
      query(`SELECT COUNT(*) AS total FROM public.users`),
      query(`SELECT id, created_at, customer_name, status, total_price
             FROM public.orders
             ORDER BY created_at DESC LIMIT 5`),
      query(`SELECT COUNT(*) AS total FROM public.leads WHERE status = 'Novo'`),
      query(`SELECT COUNT(*) AS total FROM public.agendamentos WHERE scheduled_at::date = CURRENT_DATE`),
    ]);

    return NextResponse.json({
      vendas_mes: Number(vendasMes.rows[0]?.total || 0),
      total_pedidos: Number(pedidos.rows[0]?.total || 0),
      total_clientes: Number(clientes.rows[0]?.total || 0),
      leads_novos: Number(leadsNovos.rows[0]?.total || 0),
      agendamentos_hoje: Number(agendamentosHoje.rows[0]?.total || 0),
      ultimos_pedidos: pedidosRecentes.rows,
    });
  } catch (err) {
    console.error('Erro ao buscar dashboard:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
