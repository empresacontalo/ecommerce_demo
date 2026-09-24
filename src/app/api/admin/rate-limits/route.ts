import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/utils/auth/admin';
import { listarLimites, LIMITES_PADRAO, _resetRateLimitStore } from '@/utils/rate-limit';
import { query } from '@/utils/db';
import { registrarAuditoria } from '@/utils/audit';

const DESC: Record<string, string> = {
  'rate_limit.login.max': 'Máximo de tentativas de login por IP em uma janela de tempo',
  'rate_limit.login.window_ms': 'Janela de tempo do login (milissegundos)',
  'rate_limit.checkout.max': 'Máximo de pedidos (checkout) por IP em uma janela de tempo',
  'rate_limit.checkout.window_ms': 'Janela de tempo do checkout (milissegundos)',
  'rate_limit.contato.max': 'Máximo de mensagens de contato por IP em uma janela de tempo',
  'rate_limit.contato.window_ms': 'Janela de tempo do contato (milissegundos)',
  'rate_limit.desconto.max': 'Máximo de disparos de desconto (campanha) por IP em uma janela de tempo',
  'rate_limit.desconto.window_ms': 'Janela de tempo do desconto (milissegundos)',
  'rate_limit.leads.max': 'Máximo de capturas de lead por IP em uma janela de tempo',
  'rate_limit.leads.window_ms': 'Janela de tempo dos leads (milissegundos)',
};

// GET /api/admin/rate-limits — Lista os limites (padrão + customizados no banco)
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const limites = await listarLimites();
    const items = Object.values(limites).map((l) => ({
      id: l.id,
      max: l.max,
      windowMs: l.windowMs,
      maxPadrao: LIMITES_PADRAO[l.id].max,
      windowMsPadrao: LIMITES_PADRAO[l.id].windowMs,
    }));
    return NextResponse.json(items);
  } catch (err) {
    console.error('Erro ao listar limites:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// PUT /api/admin/rate-limits — Atualiza os limites customizados
export async function PUT(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { max, windowMs, id } = body || {};

    if (!id || !LIMITES_PADRAO[id]) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const maxNum = Number(max);
    const windowNum = Number(windowMs);
    if (!Number.isInteger(maxNum) || maxNum < 1 || maxNum > 10000) {
      return NextResponse.json({ error: 'Limite de requisições deve ser um inteiro entre 1 e 10000' }, { status: 400 });
    }
    if (!Number.isInteger(windowNum) || windowNum < 1000 || windowNum > 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Janela deve estar entre 1s e 7 dias (milissegundos)' }, { status: 400 });
    }

    async function upsert(chave: string, valor: string | number, descricao: string) {
      await query(
        `INSERT INTO public.configuracoes (chave, valor, descricao)
         VALUES ($1, $2, $3)
         ON CONFLICT (chave) DO UPDATE SET valor = $2, descricao = COALESCE($3, public.configuracoes.descricao)`,
        [chave, JSON.stringify(valor), descricao]
      );
    }

    await upsert(`rate_limit.${id}.max`, String(maxNum), DESC[`rate_limit.${id}.max`] || '');
    await upsert(`rate_limit.${id}.window_ms`, String(windowNum), DESC[`rate_limit.${id}.window_ms`] || '');
    _resetRateLimitStore();

    await registrarAuditoria({
      responsavelTipo: 'admin',
      responsavelNome: admin.email || admin.id,
      acao: 'limites',
      resumo: 'Limite de acesso atualizado',
      detalhe: 'Os limites de proteção do site (quantidade de acesso por minuto) foram ajustados.',
    }, req);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar limites:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}