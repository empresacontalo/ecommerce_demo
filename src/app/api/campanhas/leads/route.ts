import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/utils/db';
import { normalizarWhatsApp } from '@/utils/campanhas';
import { rateLimit } from '@/utils/rate-limit';

interface FamiliarInput {
  nome?: string;
  whatsapp?: string;
  data_especial?: string | null;
}

// POST /api/campanhas/leads — Captura pública do formulário do bloco promocional
export async function POST(req: Request) {
  try {
    const rl = await rateLimit(req, 'leads');
    if (!rl.ok) {
      return NextResponse.json({ error: rl.erro }, { status: 429 });
    }

    const body = await req.json();
    const { campanha_id, nome, whatsapp, email, nascimento, data_especial, preferencia_lembrete, canal_preferido, familiares } = body || {};

    if (!campanha_id) return NextResponse.json({ error: 'campanha_id é obrigatório' }, { status: 400 });
    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }
    if (!whatsapp && !email) {
      return NextResponse.json({ error: 'Informe WhatsApp ou e-mail' }, { status: 400 });
    }
    if (preferencia_lembrete && !['mim', 'outros', 'ambos'].includes(preferencia_lembrete)) {
      return NextResponse.json({ error: 'preferencia_lembrete inválida' }, { status: 400 });
    }
    if (canal_preferido && !['whatsapp', 'chat', 'email'].includes(canal_preferido)) {
      return NextResponse.json({ error: 'canal_preferido inválido' }, { status: 400 });
    }

    const campanha = await query(
      `SELECT id FROM public.campanhas WHERE id = $1 AND ativo = true
       AND (data_inicio IS NULL OR data_inicio <= NOW())
       AND (data_fim IS NULL OR data_fim >= NOW())`,
      [campanha_id]
    );
    if (campanha.rows.length === 0) {
      return NextResponse.json({ error: 'Campanha não está ativa' }, { status: 404 });
    }

    const result = await query(
      `INSERT INTO public.campanha_leads
         (campanha_id, nome, whatsapp, email, nascimento, data_especial, preferencia_lembrete, canal_preferido)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        campanha_id,
        nome.trim(),
        normalizarWhatsApp(whatsapp),
        email?.trim().toLowerCase() || null,
        nascimento || null,
        data_especial || null,
        preferencia_lembrete || 'mim',
        canal_preferido || 'whatsapp',
      ]
    );
    const lead = result.rows[0];

    const famInput: FamiliarInput[] = Array.isArray(familiares) ? familiares.slice(0, 5) : [];
    await Promise.all(
      famInput.map((f) => {
        if (!f?.nome || !f?.whatsapp) return Promise.resolve();
        return query(
          `INSERT INTO public.campanha_familiares (lead_id, nome, whatsapp, data_especial)
           VALUES ($1,$2,$3,$4)`,
          [lead.id, f.nome.trim().slice(0, 120), normalizarWhatsApp(f.whatsapp), f.data_especial || null]
        );
      })
    );

    await query(
      `INSERT INTO public.campanha_historico (campanha_id, acao, detalhes) VALUES ($1,'lead_capturado',$2)`,
      [campanha_id, JSON.stringify({ lead_id: lead.id })]
    );

    return NextResponse.json({ success: true, lead_id: lead.id }, { status: 201 });
  } catch (err) {
    console.error('Erro ao capturar lead de campanha:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
