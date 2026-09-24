import { NextResponse } from 'next/server';
import { query } from '@/utils/db';

// GET /api/campanhas/ativas — Campanha elegível (prioridade centralizada) + imagens + decorações
export async function GET() {
  try {
    const result = await query(
      `SELECT * FROM public.campanhas
       WHERE ativo = true
         AND (data_inicio IS NULL OR data_inicio <= NOW())
         AND (data_fim IS NULL OR data_fim >= NOW())
       ORDER BY prioridade ASC, created_at DESC
       LIMIT 1`
    );
    if (result.rows.length === 0) return NextResponse.json({ campanha: null });

    const campanha = result.rows[0];
    const [imagens, decoracoes] = await Promise.all([
      query(
        `SELECT id, url, url_paisagem, url_retrato, status, ordem FROM public.campanha_imagens
         WHERE campanha_id = $1 AND status = 'aprovada'
         ORDER BY ordem ASC, criada_em ASC`,
        [campanha.id]
      ),
      query(`SELECT id, tipo FROM public.campanha_decoracoes WHERE campanha_id = $1`, [campanha.id]),
    ]);

    return NextResponse.json({
      campanha: {
        id: campanha.id,
        titulo: campanha.titulo,
        descricao: campanha.descricao,
        desconto: campanha.desconto,
        canal_padrao: campanha.canal_padrao,
        categoria: campanha.categoria,
      },
      imagens: imagens.rows,
      decoracoes: decoracoes.rows,
    });
  } catch (err) {
    console.error('Erro ao buscar campanha ativa:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
