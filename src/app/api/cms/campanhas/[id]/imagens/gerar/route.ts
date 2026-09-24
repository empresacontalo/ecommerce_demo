import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { getAdminSession } from '@/utils/auth/admin';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/cms/campanhas/[id]/imagens/gerar — Gera imagem com IA (gpt-image-2)
// Reusa OPENAI_API_KEY (mesmo token do Provador Virtual). Imagem nasce com
// status='pendente' e só é publicada após aprovação do administrador.
export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const API_KEY = process.env.OPENAI_API_KEY;
  if (!API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const prompt = (body?.prompt || '').trim();
    if (!prompt) return NextResponse.json({ error: 'prompt é obrigatório' }, { status: 400 });

    const campanha = await query('SELECT titulo, categoria FROM public.campanhas WHERE id = $1', [id]);
    if (campanha.rows.length === 0) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });

    const tema = campanha.rows[0].categoria || campanha.rows[0].titulo;
    const promptFinal = `Imagem promocional para campanha de venda de cabelos (${tema}). ${prompt}. Estilo fotográfico comercial, alta qualidade, sem texto.`;

    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: promptFinal, n: 1, size: '1024x1024', quality: 'low' }),
      signal: AbortSignal.timeout(90000),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      const message = errData?.error?.message || `OpenAI API error: ${openaiRes.status}`;
      console.error('[Campanhas/gerar] OpenAI Error:', message);
      return NextResponse.json({ error: `Erro ao gerar imagem: ${message}` }, { status: 502 });
    }

    const data = await openaiRes.json();
    const b64 = data?.data?.[0]?.b64_json as string | undefined;
    const url = data?.data?.[0]?.url || (b64 ? `data:image/png;base64,${b64}` : undefined);
    if (!url) return NextResponse.json({ error: 'Nenhuma imagem gerada.' }, { status: 500 });

    const result = await query(
      `WITH min_ordem AS (SELECT COALESCE(MIN(ordem), 0) AS m FROM public.campanha_imagens WHERE campanha_id = $1)
       INSERT INTO public.campanha_imagens (campanha_id, url, ordem, status, criada_por_ia)
       SELECT $1, $2, (SELECT m FROM min_ordem) - 1, 'pendente', true
       RETURNING *`,
      [id, url]
    );
    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes, criado_por) VALUES ($1,'imagem_ia_gerada',$2,$3)`,
      [id, JSON.stringify({ imagem_id: result.rows[0].id }), admin.id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[Campanhas/gerar] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
