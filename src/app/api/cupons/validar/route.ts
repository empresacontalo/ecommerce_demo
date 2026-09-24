import { NextRequest, NextResponse } from 'next/server';
import { resolverCupomAtivo } from '@/lib/cupons';

// GET /api/cupons/validar?codigo=X — Validação pública de cupom
// Usado pelo carrinho para saber se o cupom digitado é válido (campanha ativa)
// e qual desconto/escopo aplicar. O checkout revalida no servidor ao fechar.
export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get('codigo');
  try {
    const cupom = codigo ? await resolverCupomAtivo(codigo) : null;
    if (!cupom) {
      return NextResponse.json({ ok: false, error: 'Cupom inválido ou campanha encerrada.' }, { status: 200 });
    }
    return NextResponse.json({ ok: true, cupom });
  } catch (err) {
    console.error('Erro ao validar cupom:', err);
    return NextResponse.json({ ok: false, error: 'Erro interno ao validar cupom.' }, { status: 500 });
  }
}